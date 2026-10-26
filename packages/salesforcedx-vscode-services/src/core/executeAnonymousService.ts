/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  executeAnonymous,
  type ApexCompileError,
  type ApexRuntimeError,
  type ExecuteAnonymousOutcome
} from '@salesforce/apex-node/effect';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ExecuteAnonymousError } from '../errors/executeAnonymousErrors';
import { ChannelService } from '../vscode/channelService';
import { ConnectionService } from './connectionService';

/** Discriminated outcomes; diagnostics exist only on their matching failures. */
export type ExecuteAnonymousResult =
  | Pick<ExecuteAnonymousOutcome, 'compiled' | 'success'>
  | (Pick<ApexCompileError, 'line' | 'column' | 'compileProblem'> & { compiled: false; success: false })
  | (Pick<ApexRuntimeError, 'line' | 'column' | 'exceptionMessage' | 'exceptionStackTrace'> & {
      compiled: true;
      success: false;
    });

const ANON_APEX_ERRORS_COLLECTION = 'apex-anon-errors';
const UNEXPECTED_ERROR = 'Unexpected error during anonymous Apex execution';
const diagnosticMessage = (message: string | null): string =>
  message === null || message === '' ? UNEXPECTED_ERROR : message;

/** Keeps the services result contract while delegating execution to apex-node. */
export const executeAnonymousWithConnection = Effect.fn('ExecuteAnonymousService.executeAnonymousWithConnection')(
  function* (connection: Connection, code: string) {
    if (!connection.accessToken) {
      return yield* new ExecuteAnonymousError({ message: 'Execute anonymous failed: no access token' });
    }

    const { result, logBody } = yield* executeAnonymous(connection, { apexCode: code }).pipe(
      Effect.map(({ logBody: outcomeLogBody, ...outcomeResult }) => ({
        result: outcomeResult satisfies ExecuteAnonymousResult,
        logBody: outcomeLogBody ?? ''
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
        ApexResponseDecodeError: error =>
          Effect.fail(
            new ExecuteAnonymousError({
              message: 'Invalid execute anonymous SOAP response',
              cause: error
            })
          ),
        ApexOperationError: error =>
          Effect.fail(
            new ExecuteAnonymousError({
              message: `Execute anonymous failed: ${error.message}`,
              cause: error
            })
          )
      })
    );
    return { result, logBody, logId: undefined };
  }
);

export class ExecuteAnonymousService extends Effect.Service<ExecuteAnonymousService>()('ExecuteAnonymousService', {
  accessors: true,
  dependencies: [ConnectionService.Default, ChannelService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const diagnostics = vscode.languages.createDiagnosticCollection(ANON_APEX_ERRORS_COLLECTION);

    /** initiates an execute anonymous and retrieves the log.  Returns the result, log body, and log id */
    const executeAndRetrieveLog = Effect.fn('ExecuteAnonymousService.executeAndRetrieveLog')(function* (code: string) {
      return yield* connectionService
        .getConnection()
        .pipe(Effect.flatMap(conn => executeAnonymousWithConnection(conn, code)));
    });

    /** Output result to channel; errors get full detail, success gets one line */
    const outputToChannel = Effect.fn('ExecuteAnonymousService.outputToChannel')(function* (
      result: ExecuteAnonymousResult
    ) {
      const channelService = yield* ChannelService;
      const text = result.success
        ? 'Execute anonymous succeeded.'
        : !result.compiled
          ? `Error: Line ${result.line}, Column ${result.column} -- ${diagnosticMessage(result.compileProblem)}`
          : `Compile: success / Error: ${diagnosticMessage(result.exceptionMessage)}\n${result.exceptionStackTrace ?? ''}`;
      yield* channelService.appendToChannel(text);
    });

    const setDiagnostics = (
      result: ExecuteAnonymousResult,
      documentUri: URI,
      selectionStartLine: number | undefined
    ): void => {
      diagnostics.delete(documentUri);
      if (result.success) return;
      const message = result.compiled
        ? diagnosticMessage(result.exceptionMessage)
        : diagnosticMessage(result.compileProblem);
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
