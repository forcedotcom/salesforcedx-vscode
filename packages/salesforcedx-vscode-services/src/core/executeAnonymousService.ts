/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ExecuteAnonymousError } from '../errors/executeAnonymousErrors';
import { ChannelService } from '../vscode/channelService';
import { ApexLogService } from './apexLogService';
import { ConnectionService } from './connectionService';
import { unknownToErrorCause } from './shared';
import { TraceFlagService } from './traceFlagService';

export type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';

const SHORT_LIVED_TRACE_FLAG_DURATION = Duration.minutes(5);
const ANON_APEX_ERRORS_COLLECTION = 'apex-anon-errors';
const UNEXPECTED_ERROR = 'Unexpected error during anonymous Apex execution';

export class ExecuteAnonymousService extends Effect.Service<ExecuteAnonymousService>()('ExecuteAnonymousService', {
  accessors: true,
  dependencies: [ConnectionService.Default, TraceFlagService.Default, ApexLogService.Default, ChannelService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const traceFlagService = yield* TraceFlagService;
    const logService = yield* ApexLogService;
    const channelService = yield* ChannelService;
    const diagnostics = vscode.languages.createDiagnosticCollection(ANON_APEX_ERRORS_COLLECTION);

    /** initiates an execute anonymous.  Returns only the json result */
    const executeAnonymous = Effect.fn('ExecuteAnonymousService.executeAnonymous')(function* (code: string) {
      const conn = yield* connectionService.getConnection();
      return yield* Effect.tryPromise({
        try: () => conn.tooling.executeAnonymous(code),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new ExecuteAnonymousError({
            message: `Execute anonymous failed: ${cause.message}`,
            cause: error
          });
        }
      });
    });

    /** initiates an execute anonymous and retrieves the log.  Returns the result, log body, and log id */
    const executeAndRetrieveLog = Effect.fn('ExecuteAnonymousService.executeAndRetrieveLog')(function* (code: string) {
      const userId = yield* traceFlagService.getUserId();
      const { created, traceFlagId } = yield* traceFlagService.ensureTraceFlag(userId, SHORT_LIVED_TRACE_FLAG_DURATION);
      const result = yield* executeAnonymous(code);
      const logs = yield* logService.listLogs(5, {
        userId,
        operationContains: 'executeAnonymous'
      });
      // assumption: the user is not kicking off multiple execute anonymous operations at the same time
      // alternative is using the SOAP API to get the log result from the transaction
      const logId = logs[0]?.Id;
      const logBody = logId ? yield* logService.getLogBody(logId) : '';
      created && traceFlagId ? yield* traceFlagService.deleteTraceFlag(traceFlagId) : yield* Effect.void;
      return { result, logBody, logId };
    });

    const outputToChannel = (result: ExecuteAnonymousResult) =>
      Effect.gen(function* () {
        const text = result.success
          ? 'Compile: success / Execute: success'
          : !result.compiled
            ? `Error: Line ${result.line}, Column ${result.column} -- ${result.compileProblem ?? UNEXPECTED_ERROR}`
            : `Compile: success / Error: ${result.exceptionMessage ?? UNEXPECTED_ERROR}\n${result.exceptionStackTrace ?? ''}`;
        yield* channelService.appendToChannel(text);
      });

    const setDiagnostics = (
      result: ExecuteAnonymousResult,
      uri: URI,
      selectionStartLine: number | undefined
    ): void => {
      diagnostics.clear();
      if (!result.success) {
        const message =
          (result.compileProblem && result.compileProblem !== ''
            ? result.compileProblem
            : result.exceptionMessage && result.exceptionMessage !== ''
              ? result.exceptionMessage
              : UNEXPECTED_ERROR) ?? UNEXPECTED_ERROR;
        const line = result.line ? result.line + (selectionStartLine ?? 0) : 1;
        const column = result.column ?? 1;
        const pos = new vscode.Position(line > 0 ? line - 1 : 0, column > 0 ? column - 1 : 0);
        diagnostics.set(vscode.Uri.parse(uri.toString()), [
          {
            message,
            severity: vscode.DiagnosticSeverity.Error,
            source: uri.fsPath ?? uri.path ?? uri.toString(),
            range: new vscode.Range(pos, pos)
          }
        ]);
      }
    };

    /** Report execute anonymous result via output channel and editor diagnostics. */
    const reportExecResult = Effect.fn('ExecuteAnonymousService.reportExecResult')(
      (
        result: ExecuteAnonymousResult,
        uri: URI,
        selectionStartLine?: number
      ) =>
        Effect.gen(function* () {
          yield* outputToChannel(result);
          yield* Effect.sync(() => setDiagnostics(result, uri, selectionStartLine));
        })
    );

    return { executeAnonymous, executeAndRetrieveLog, reportExecResult };
  })
}) {}
