/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import { redactValue } from '@salesforce/playwright-vscode-ext';
import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as FiberSet from 'effect/FiberSet';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Match from 'effect/Match';
import { isError } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import process = require('node:process');
import { ControllerService, ControllerServiceLayer } from './controllerService';
import { DrivableVscodeMcpShutdownError } from './errors';
import { drivablePlatformLayer } from './platformLayer';
import { ActInput, StartInput, DrivableVscodeFinding } from './schemas';

const SERVER_INFO = { name: 'drivable-vscode', version: '0.1.0' };
const AppLayer = ControllerServiceLayer.pipe(Layer.provideMerge(drivablePlatformLayer));
const EmptyInput = Schema.Struct({});
const emptyInputSchema = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false
} satisfies Tool['inputSchema'];
const inputSchema = <S extends Schema.Constraint>(schema: S): Tool['inputSchema'] => {
  const jsonSchema = Schema.toJsonSchemaDocument(Schema.toCodecJson(schema)).schema;
  if (!('type' in jsonSchema) || jsonSchema.type !== 'object')
    // eslint-disable-next-line functional/no-throw-statements -- MCP requires object schemas; fail startup on invalid definitions.
    throw new TypeError('MCP tool input schema must be an object');
  return { ...jsonSchema, type: 'object' };
};
const decodeInput = <S extends Schema.ConstraintDecoder<unknown, never>>(schema: S, input: unknown) =>
  Effect.fromResult(Schema.decodeUnknownResult(Schema.toCodecJson(schema))(input));
const tools = [
  { name: 'start', description: 'Start the single drivable VS Code session.', inputSchema: inputSchema(StartInput) },
  {
    name: 'observe',
    description: 'Capture the current bounded UI state and screenshot.',
    inputSchema: emptyInputSchema
  },
  {
    name: 'act',
    description: 'Perform one constrained UI action against the latest observation.',
    inputSchema: inputSchema(ActInput)
  },
  {
    name: 'add_finding',
    description: 'Persist a drivable VS Code finding with reproducible evidence.',
    inputSchema: inputSchema(DrivableVscodeFinding)
  },
  {
    name: 'status',
    description: 'Report session state, artifacts, and finding count.',
    inputSchema: emptyInputSchema
  },
  {
    name: 'finish',
    description: 'Capture final evidence and idempotently close the session.',
    inputSchema: emptyInputSchema
  }
] satisfies Tool[];

const textResult = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(redactValue(value), undefined, 2) }]
});
const toolError = (error: unknown): CallToolResult => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(
        redactValue(
          isError(error)
            ? {
                name: error.name,
                message: error.message,
                ...(typeof error.cause === 'string' ? { cause: error.cause } : {})
              }
            : error
        ),
        undefined,
        2
      )
    }
  ],
  isError: true
});

const callTool = Effect.fn('McpServer.callTool')(function* (name: string, args: unknown) {
  const controller = yield* ControllerService;
  return yield* Match.value(name).pipe(
    Match.when('start', () =>
      decodeInput(StartInput, args).pipe(
        Effect.flatMap(value => controller.start(value.objective, value)),
        Effect.map(session =>
          textResult({ runId: session.runId, artifactDir: session.artifactDir, workspaceDir: session.workspaceDir })
        )
      )
    ),
    Match.when('observe', () =>
      decodeInput(EmptyInput, args).pipe(
        Effect.flatMap(() => controller.observeForMcp),
        Effect.map(
          ({ observation, screenshot }) =>
            ({
              content: [
                { type: 'text', text: JSON.stringify(redactValue(observation), undefined, 2) },
                { type: 'image', data: Buffer.from(screenshot).toString('base64'), mimeType: 'image/png' }
              ]
            }) satisfies CallToolResult
        )
      )
    ),
    Match.when('act', () =>
      decodeInput(ActInput, args).pipe(
        Effect.flatMap(value =>
          controller
            .act({ ...value.action, observationSequence: value.observationSequence })
            .pipe(Effect.as(textResult({ acted: true, observationSequence: value.observationSequence })))
        )
      )
    ),
    Match.when('add_finding', () =>
      decodeInput(DrivableVscodeFinding, args).pipe(
        Effect.flatMap(controller.addFinding),
        Effect.as(textResult({ added: true }))
      )
    ),
    Match.when('status', () =>
      decodeInput(EmptyInput, args).pipe(
        Effect.flatMap(() => controller.status),
        Effect.map(textResult)
      )
    ),
    Match.when('finish', () =>
      decodeInput(EmptyInput, args).pipe(
        Effect.flatMap(() => controller.finish),
        Effect.flatMap(() => controller.status),
        Effect.map(textResult)
      )
    ),
    Match.orElse(toolName => Effect.fail(new McpError(ErrorCode.InvalidParams, `Tool ${toolName} not found`)))
  );
});

/** Creates the MCP server independently of stdio for contract testing. */
type ServerShutdown = Effect.Effect<void, DrivableVscodeMcpShutdownError>;
const serverShutdowns = new WeakMap<Server, ServerShutdown>();
const finishController = Effect.gen(function* () {
  const controller = yield* ControllerService;
  return yield* controller.finish;
});

export const createDrivableVscodeMcpServer = async (
  runtime: ManagedRuntime.ManagedRuntime<ControllerService, never>,
  finish: typeof finishController = finishController,
  dispose: Effect.Effect<void> = Effect.void
): Promise<Server> => {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
    instructions:
      'Run one drivable-vscode session at a time: start, observe before acting, use the latest observation sequence, record findings immediately, then finish. After finish, start another session as needed.'
  });
  const accepting = Ref.makeUnsafe(true);
  const handlerScope = Effect.runSync(Scope.make());
  const activeHandlers = FiberSet.make<CallToolResult, McpError>().pipe(Scope.provide(handlerScope), Effect.runSync);
  const runHandler = await runtime.runPromise(FiberSet.runtimePromise(activeHandlers)<ControllerService>());
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, (request, extra) => {
    if (!accepting.pipe(Ref.get, Effect.runSync))
      return Promise.reject(new McpError(ErrorCode.InternalError, 'drivable-vscode MCP server is shutting down'));
    return runHandler(
      callTool(request.params.name, request.params.arguments ?? {}).pipe(
        Effect.match({ onFailure: toolError, onSuccess: value => value })
      ),
      { signal: extra.signal, propagateInterruption: true }
    );
  });
  const shutdown = Effect.fn('McpServer.shutdown')(function* () {
    yield* Ref.set(accepting, false);
    yield* FiberSet.clear(activeHandlers);
    yield* FiberSet.awaitEmpty(activeHandlers);
    const finishExit = yield* Effect.exit(
      Effect.tryPromise({
        try: () => runtime.runPromise(finish),
        catch: cause =>
          new DrivableVscodeMcpShutdownError({
            message: 'Failed to finish drivable VS Code session',
            cause: getErrorMessage(cause)
          })
      })
    );
    const serverExit = yield* Effect.exit(
      Effect.tryPromise({
        try: () => server.close(),
        catch: cause =>
          new DrivableVscodeMcpShutdownError({ message: 'Failed to close MCP server', cause: getErrorMessage(cause) })
      })
    );
    yield* Scope.close(handlerScope, Exit.void);
    const runtimeExit = yield* Effect.exit(dispose);
    const failures = [finishExit, serverExit, runtimeExit].filter(Exit.isFailure);
    if (failures.length > 0) {
      return yield* new DrivableVscodeMcpShutdownError({
        message: 'Failed to shut down drivable VS Code MCP server',
        cause: failures.map(failure => getErrorMessage(failure.cause)).join('\n')
      });
    }
  });
  serverShutdowns.set(server, shutdown());
  return server;
};

/** Stops request handling and releases the server and runtime in order. */
export const shutdownDrivableVscodeMcpServer = (server: Server): ServerShutdown =>
  serverShutdowns.get(server) ??
  Effect.tryPromise({
    try: () => server.close(),
    catch: cause =>
      new DrivableVscodeMcpShutdownError({ message: 'Failed to close MCP server', cause: getErrorMessage(cause) })
  });

const serverProgram = Effect.fn('McpServer.serverProgram')(function* () {
  const runtime = ManagedRuntime.make(AppLayer);
  yield* Effect.addFinalizer(() => runtime.disposeEffect.pipe(Effect.orDie));
  const server = yield* Effect.tryPromise({
    try: () => createDrivableVscodeMcpServer(runtime, undefined, Effect.void),
    catch: cause =>
      new DrivableVscodeMcpShutdownError({
        message: 'Failed to initialize drivable VS Code MCP server',
        cause: getErrorMessage(cause)
      })
  });
  yield* Effect.addFinalizer(() => shutdownDrivableVscodeMcpServer(server).pipe(Effect.orDie));
  const transport = new StdioServerTransport();
  const stopped = yield* Deferred.make<void>();
  const context = yield* Effect.context<never>();
  const runSyncWithContext = Effect.runSyncWith(context);
  const stop = () => runSyncWithContext(Deferred.succeed(stopped, undefined));
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      process.stdin.once('end', stop);
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      transport.onclose = stop;
    }),
    () =>
      Effect.sync(() => {
        process.stdin.off('end', stop);
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        transport.onclose = undefined;
      })
  );
  yield* Effect.tryPromise(() => server.connect(transport));
  yield* Deferred.await(stopped);
});

if (process.env.DRIVABLE_VSCODE_MCP_MAIN === '1') {
  serverProgram()
    .pipe(Effect.scoped, Effect.runPromise)
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
