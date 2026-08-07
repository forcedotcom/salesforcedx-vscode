/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
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
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as FiberSet from 'effect/FiberSet';
import * as JSONSchema from 'effect/JSONSchema';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Match from 'effect/Match';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import process = require('node:process');
import { ControllerService } from './controllerService';
import { causeMessage, VisualQaMcpShutdownError } from './errors';
import { ActInput, StartInput, VisualQaFinding } from './schemas';

const SERVER_INFO = { name: 'telecode', version: '0.1.0' };
const AppLayer = ControllerService.Default.pipe(Layer.provide(Layer.merge(NodeFileSystem.layer, NodePath.layer)));
const EmptyInput = Schema.Struct({}).annotations({
  jsonSchema: { type: 'object', properties: {}, required: [], additionalProperties: false }
});
const inputSchema = <A, I>(schema: Schema.Schema<A, I>): Tool['inputSchema'] => {
  const jsonSchema = JSONSchema.make(schema);
  if (!('type' in jsonSchema) || jsonSchema.type !== 'object')
    throw new TypeError('MCP tool input schema must be an object');
  return { ...jsonSchema };
};
const tools = [
  { name: 'start', description: 'Start the single visual QA session.', inputSchema: inputSchema(StartInput) },
  {
    name: 'observe',
    description: 'Capture the current bounded UI state and screenshot.',
    inputSchema: inputSchema(EmptyInput)
  },
  {
    name: 'act',
    description: 'Perform one constrained UI action against the latest observation.',
    inputSchema: inputSchema(ActInput)
  },
  {
    name: 'add_finding',
    description: 'Persist a visual QA finding with reproducible evidence.',
    inputSchema: inputSchema(VisualQaFinding)
  },
  {
    name: 'status',
    description: 'Report session state, artifacts, and finding count.',
    inputSchema: inputSchema(EmptyInput)
  },
  {
    name: 'finish',
    description: 'Capture final evidence and idempotently close the session.',
    inputSchema: inputSchema(EmptyInput)
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
        redactValue(error instanceof Error ? { name: error.name, message: error.message } : error),
        undefined,
        2
      )
    }
  ],
  isError: true
});

const callTool = Effect.fn('McpServer.callTool')(function* (name: string, args: unknown) {
  return yield* Match.value(name).pipe(
    Match.when('start', () =>
      Schema.decodeUnknown(StartInput)(args).pipe(
        Effect.flatMap(value => ControllerService.start(value.objective, value)),
        Effect.map(session =>
          textResult({ runId: session.runId, artifactDir: session.artifactDir, workspaceDir: session.workspaceDir })
        )
      )
    ),
    Match.when('observe', () =>
      Schema.decodeUnknown(EmptyInput)(args).pipe(
        Effect.zipRight(ControllerService.observeForMcp),
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
      Schema.decodeUnknown(ActInput)(args).pipe(
        Effect.flatMap(value =>
          ControllerService.act({ ...value.action, observationSequence: value.observationSequence }).pipe(
            Effect.as(textResult({ acted: true, observationSequence: value.observationSequence }))
          )
        )
      )
    ),
    Match.when('add_finding', () =>
      Schema.decodeUnknown(VisualQaFinding)(args).pipe(
        Effect.flatMap(ControllerService.addFinding),
        Effect.as(textResult({ added: true }))
      )
    ),
    Match.when('status', () =>
      Schema.decodeUnknown(EmptyInput)(args).pipe(Effect.zipRight(ControllerService.status), Effect.map(textResult))
    ),
    Match.when('finish', () =>
      Schema.decodeUnknown(EmptyInput)(args).pipe(
        Effect.zipRight(ControllerService.finish),
        Effect.zipRight(ControllerService.status),
        Effect.map(textResult)
      )
    ),
    Match.orElse(toolName => Effect.fail(new McpError(ErrorCode.InvalidParams, `Tool ${toolName} not found`)))
  );
});

/** Creates the MCP server independently of stdio for contract testing. */
type ServerShutdown = Effect.Effect<void, VisualQaMcpShutdownError>;
const serverShutdowns = new WeakMap<Server, ServerShutdown>();

export const createVisualQaMcpServer = (
  runtime: Runtime.Runtime<ControllerService>,
  finish: Effect.Effect<void, unknown, ControllerService> = ControllerService.finish,
  dispose: Effect.Effect<void, unknown> = Effect.void
): Server => {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
    instructions:
      'Run one Telecode session at a time: start, observe before acting, use the latest observation sequence, record findings immediately, then finish. After finish, start another session as needed.'
  });
  const accepting = Ref.unsafeMake(true);
  const handlerScope = Effect.runSync(Scope.make());
  const activeHandlers = Effect.runSync(FiberSet.make<CallToolResult>().pipe(Scope.extend(handlerScope)));
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, (request, extra) =>
    Runtime.runPromise(runtime)(
      Ref.get(accepting).pipe(
        Effect.flatMap(isAccepting =>
          isAccepting
            ? FiberSet.run(
                activeHandlers,
                callTool(request.params.name, request.params.arguments ?? {}).pipe(
                  Effect.match({ onFailure: toolError, onSuccess: value => value })
                ),
                { propagateInterruption: true }
              ).pipe(Effect.flatMap(Fiber.join))
            : Effect.fail(new McpError(ErrorCode.InternalError, 'Telecode MCP server is shutting down'))
        )
      ),
      { signal: extra.signal }
    )
  );
  const shutdown = Effect.fn('McpServer.shutdown')(function* () {
    yield* Ref.set(accepting, false);
    yield* FiberSet.clear(activeHandlers);
    yield* FiberSet.awaitEmpty(activeHandlers);
    const finishExit = yield* Effect.exit(
      Effect.tryPromise({
        try: () => Runtime.runPromise(runtime)(finish),
        catch: cause =>
          new VisualQaMcpShutdownError({ message: 'Failed to finish visual QA session', cause: causeMessage(cause) })
      })
    );
    const serverExit = yield* Effect.exit(
      Effect.tryPromise({
        try: () => server.close(),
        catch: cause =>
          new VisualQaMcpShutdownError({ message: 'Failed to close MCP server', cause: causeMessage(cause) })
      })
    );
    yield* Scope.close(handlerScope, Exit.void);
    const runtimeExit = yield* Effect.exit(dispose);
    const failures = [finishExit, serverExit, runtimeExit].filter(Exit.isFailure);
    if (failures.length > 0) {
      return yield* new VisualQaMcpShutdownError({
        message: 'Failed to shut down visual QA MCP server',
        cause: failures.map(failure => causeMessage(failure.cause)).join('\n')
      });
    }
  });
  serverShutdowns.set(server, shutdown());
  return server;
};

/** Stops request handling and releases the server and runtime in order. */
export const shutdownVisualQaMcpServer = (server: Server): ServerShutdown =>
  serverShutdowns.get(server) ??
  Effect.tryPromise({
    try: () => server.close(),
    catch: cause => new VisualQaMcpShutdownError({ message: 'Failed to close MCP server', cause: causeMessage(cause) })
  });

const serverProgram = Effect.fn('McpServer.serverProgram')(function* () {
  const runtime = ManagedRuntime.make(AppLayer);
  const server = createVisualQaMcpServer(yield* runtime.runtimeEffect, ControllerService.finish, runtime.disposeEffect);
  yield* Effect.addFinalizer(() => shutdownVisualQaMcpServer(server).pipe(Effect.orDie));
  const transport = new StdioServerTransport();
  const stopped = yield* Deferred.make<void>();
  const stop = () => Runtime.runFork(Runtime.defaultRuntime)(Deferred.succeed(stopped, undefined));
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

if (process.env.TELECODE_MCP_MAIN === '1') {
  serverProgram()
    .pipe(Effect.scoped, Effect.runPromise)
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
