/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { executeAnonymous } from '@salesforce/apex-node/effect';
import type { Connection } from '@salesforce/core';
import {
  ChannelService,
  ConnectionService,
  ExecuteAnonymousError,
  ExecuteAnonymousService,
  type ExecuteAnonymousResult,
  type ExecuteAnonymousWithLog
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isNull } from 'effect/Predicate';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const diagnosticMessage = (message: string | null) =>
  isNull(message) || message === '' ? 'Unexpected error during anonymous Apex execution' : message;

/** Native V4 Apex operations; no V3/Promise compatibility runner or foreign Cause conversion. */
export const executeAnonymousWithConnection: (
  connection: Connection,
  code: string
) => Effect.Effect<ExecuteAnonymousWithLog, ExecuteAnonymousError> = Effect.fn(
  'ExecuteAnonymousService.executeAnonymousWithConnection'
)(function* (connection: Connection, code: string): Effect.fn.Return<ExecuteAnonymousWithLog, ExecuteAnonymousError> {
  if (!connection.accessToken)
    return yield* new ExecuteAnonymousError({ message: 'Execute anonymous failed: no access token' });
  const { result, logBody } = yield* executeAnonymous(connection, { apexCode: code }).pipe(
    Effect.map(({ logBody: log, ...outcomeResult }) => ({
      result: outcomeResult satisfies ExecuteAnonymousResult,
      logBody: log ?? ''
    })),
    Effect.catchTags({
      ApexCompileError: error =>
        Effect.succeed({
          result: {
            compiled: false,
            success: false,
            line: error.line,
            column: error.column,
            compileProblem: error.compileProblem
          } satisfies ExecuteAnonymousResult,
          logBody: error.logBody ?? ''
        }),
      ApexRuntimeError: error =>
        Effect.succeed({
          result: {
            compiled: true,
            success: false,
            line: error.line,
            column: error.column,
            exceptionMessage: error.exceptionMessage,
            exceptionStackTrace: error.exceptionStackTrace
          } satisfies ExecuteAnonymousResult,
          logBody: error.logBody ?? ''
        })
    }),
    Effect.catchTags({
      ApexResponseDecodeError: cause =>
        new ExecuteAnonymousError({ message: 'Invalid execute anonymous SOAP response', cause }),
      ApexOperationError: cause =>
        new ExecuteAnonymousError({ message: `Execute anonymous failed: ${cause.message}`, cause })
    })
  );
  return { result, logBody, logId: undefined };
});

export const ExecuteAnonymousServiceLayer = Layer.effect(
  ExecuteAnonymousService,
  Effect.gen(function* () {
    const connections = yield* ConnectionService;
    const operations = yield* ServiceOperations;
    const diagnostics = yield* Effect.acquireRelease(
      Effect.sync(() => vscode.languages.createDiagnosticCollection('apex-anon-errors')),
      collection =>
        Effect.sync(() => {
          collection.dispose();
        })
    );
    // Reject/drain consumer-owned calls before disposing their diagnostic collection.
    yield* Effect.addFinalizer(() => operations.close);
    const setDiagnostics = (result: ExecuteAnonymousResult, uri: URI, selectionStartLine?: number) => {
      diagnostics.delete(uri);
      if (result.success) return;
      const message = diagnosticMessage(result.compiled ? result.exceptionMessage : result.compileProblem);
      const line = result.line ? result.line + (selectionStartLine ?? 0) : 1;
      const column = result.column ?? 1;
      const position = new vscode.Position(line > 0 ? line - 1 : 0, column > 0 ? column - 1 : 0);
      diagnostics.set(uri, [
        {
          message,
          severity: vscode.DiagnosticSeverity.Error,
          source: uri.fsPath ?? uri.path ?? uri.toString(),
          range: new vscode.Range(position, position)
        }
      ]);
    };
    return ExecuteAnonymousService.of({
      executeAndRetrieveLog: Effect.fn('ExecuteAnonymousService.executeAndRetrieveLog')(
        (code: string) =>
          connections
            .getConnection()
            .pipe(Effect.flatMap(connection => executeAnonymousWithConnection(connection, code))),
        operations.run
      ),
      reportExecResult: Effect.fn('ExecuteAnonymousService.reportExecResult')(function* (
        result: ExecuteAnonymousResult,
        documentUri: URI,
        selectionStartLine?: number,
        logBody?: string
      ) {
        // The caller's channel stays a requirement; do not capture the provider's default channel.
        const channel = yield* ChannelService;
        const text = result.success
          ? 'Execute anonymous succeeded.'
          : !result.compiled
            ? `Error: Line ${result.line}, Column ${result.column} -- ${diagnosticMessage(result.compileProblem)}`
            : `Compile: success / Error: ${diagnosticMessage(result.exceptionMessage)}\n${result.exceptionStackTrace ?? ''}`;
        yield* channel.clearChannel;
        yield* channel.appendToChannel(text);
        if (logBody) yield* channel.appendToChannel(logBody);
        yield* channel.getChannel.pipe(Effect.tap(output => Effect.sync(() => output.show())));
        yield* Effect.sync(() => setDiagnostics(result, documentUri, selectionStartLine));
      }, operations.run),
      clearDiagnostics: Effect.fn('ExecuteAnonymousService.clearDiagnostics', {
        attributes: { telemetryIgnore: true }
      })((uri: URI) => Effect.sync(() => diagnostics.delete(uri)), operations.run)
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
