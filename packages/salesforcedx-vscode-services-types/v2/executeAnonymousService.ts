/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ChannelService } from './channelService.js';
import type { ConnectionError } from './connectionService.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { URI } from 'vscode-uri';

/** Diagnostics exist only on the matching compilation/runtime failure. */
export type ExecuteAnonymousResult =
  | { readonly compiled: true; readonly success: true; readonly line: number; readonly column: number }
  | {
      readonly compiled: false;
      readonly success: false;
      readonly line: number;
      readonly column: number;
      readonly compileProblem: string | null;
    }
  | {
      readonly compiled: true;
      readonly success: false;
      readonly line: number;
      readonly column: number;
      readonly exceptionMessage: string | null;
      readonly exceptionStackTrace: string | null;
    };
export type ExecuteAnonymousWithLog = {
  readonly result: ExecuteAnonymousResult;
  readonly logBody: string;
  readonly logId: undefined;
};
export class ExecuteAnonymousError extends Schema.TaggedError<ExecuteAnonymousError>()('ExecuteAnonymousError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}
export class ExecuteAnonymousService extends Context.Service<
  ExecuteAnonymousService,
  {
    readonly executeAndRetrieveLog: (
      code: string
    ) => Effect.Effect<ExecuteAnonymousWithLog, ConnectionError | ExecuteAnonymousError>;
    readonly reportExecResult: (
      result: ExecuteAnonymousResult,
      documentUri: URI,
      selectionStartLine?: number,
      logBody?: string
    ) => Effect.Effect<void, never, ChannelService>;
    readonly clearDiagnostics: (documentUri: URI) => Effect.Effect<void>;
  }
>()('@salesforce/vscode-services/v2/ExecuteAnonymousService') {}
