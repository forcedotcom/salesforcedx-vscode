/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { executeAnonymous } from '@salesforce/apex-node/effect';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ExecuteAnonymousError } from '../errors/executeAnonymousErrors';
import { ChannelService } from '../vscode/channelService';
import { ConnectionService } from './connectionService';

export type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';

const ANON_APEX_ERRORS_COLLECTION = 'apex-anon-errors';
const UNEXPECTED_ERROR = 'Unexpected error during anonymous Apex execution';

/** Keeps the services result contract while delegating execution to apex-node. */
export const executeAnonymousWithConnection = (connection: Connection, code: string) =>
  Effect.gen(function* () {
    if (!connection.accessToken) {
      return yield* new ExecuteAnonymousError({ message: 'Execute anonymous failed: no access token' });
    }

    const { logBody, ...result } = yield* executeAnonymous(connection, { apexCode: code }).pipe(
      Effect.mapError(
        error =>
          new ExecuteAnonymousError({
            message:
              error._tag === 'ApexResponseDecodeError'
                ? 'Invalid SOAP response: missing executeAnonymousResponse.result'
                : `Execute anonymous failed: ${error.message}`,
            cause: error
          })
      )
    );
    return { result: result satisfies ExecuteAnonymousResult, logBody, logId: undefined };
  });

export class ExecuteAnonymousService extends Effect.Service<ExecuteAnonymousService>()('ExecuteAnonymousService', {
  accessors: true,
  dependencies: [ConnectionService.Default, ChannelService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const diagnostics = vscode.languages.createDiagnosticCollection(ANON_APEX_ERRORS_COLLECTION);

    /** initiates an execute anonymous and retrieves the log.  Returns the result, log body, and log id */
    const executeAndRetrieveLog = Effect.fn('ExecuteAnonymousService.executeAndRetrieveLog')(function* (code: string) {
      const conn = yield* connectionService.getConnection();
      return yield* executeAnonymousWithConnection(conn, code);
    });

    /** Output result to channel; errors get full detail, success gets one line */
    const outputToChannel = Effect.fn('ExecuteAnonymousService.outputToChannel')(function* (
      result: ExecuteAnonymousResult
    ) {
      const channelService = yield* ChannelService;
      const text = result.success
        ? 'Execute anonymous succeeded.'
        : !result.compiled
          ? `Error: Line ${result.line}, Column ${result.column} -- ${result.compileProblem ?? UNEXPECTED_ERROR}`
          : `Compile: success / Error: ${result.exceptionMessage ?? UNEXPECTED_ERROR}\n${result.exceptionStackTrace ?? ''}`;
      yield* channelService.appendToChannel(text);
    });

    const setDiagnostics = (
      result: ExecuteAnonymousResult,
      documentUri: URI,
      selectionStartLine: number | undefined
    ): void => {
      diagnostics.delete(documentUri);
      if (result.success) return;
      const message =
        (result.compileProblem && result.compileProblem !== ''
          ? result.compileProblem
          : result.exceptionMessage && result.exceptionMessage !== ''
            ? result.exceptionMessage
            : UNEXPECTED_ERROR) ?? UNEXPECTED_ERROR;
      const line = result.line ? result.line + (selectionStartLine ?? 0) : 1;
      const column = result.column ?? 1;
      const pos = new vscode.Position(line > 0 ? line - 1 : 0, column > 0 ? column - 1 : 0);
      diagnostics.set(documentUri, [
        {
          message,
          severity: vscode.DiagnosticSeverity.Error,
          source: documentUri.fsPath ?? documentUri.path ?? documentUri.toString(),
          range: new vscode.Range(pos, pos)
        }
      ]);
    };

    const clearDiagnostics = Effect.fn('ExecuteAnonymousService.clearDiagnostics', {
      attributes: { telemetryIgnore: true } // produces way too many useless events
    })((documentUri: URI) => Effect.sync(() => diagnostics.delete(documentUri)));

    /** Report execute anonymous result via output channel and editor diagnostics. */
    const reportExecResult = Effect.fn('ExecuteAnonymousService.reportExecResult')(function* (
      result: ExecuteAnonymousResult,
      documentUri: URI,
      selectionStartLine?: number,
      logBody?: string
    ) {
      const channelService = yield* ChannelService;
      yield* channelService.clearChannel;
      yield* outputToChannel(result);
      if (logBody) {
        yield* channelService.appendToChannel(logBody);
      }
      const channel = yield* channelService.getChannel;
      yield* Effect.sync(() => channel.show());
      yield* Effect.sync(() => setDiagnostics(result, documentUri, selectionStartLine));
    });

    return {
      executeAndRetrieveLog,
      reportExecResult,
      clearDiagnostics
    };
  })
}) {}
