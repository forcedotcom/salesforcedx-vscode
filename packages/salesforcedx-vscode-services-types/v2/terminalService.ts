/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import type * as Duration from 'effect/Duration';
import type * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

export class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  errorType: Schema.Literals(['nonzero_exit', 'spawn_error', 'timeout', 'unknown', 'unsupported_platform']),
  exitCode: Schema.optional(Schema.Number),
  stdoutBytes: Schema.Number,
  stderrBytes: Schema.Number
}) {}

export type SimpleExecInput<A> = {
  readonly executable: string;
  readonly args: readonly string[];
  readonly parse: (stdout: string) => A;
  readonly timeout?: Duration.Input;
  readonly env?: Record<string, string>;
  readonly cwd?: string;
};

export class TerminalService extends Context.Service<
  TerminalService,
  {
    readonly simpleExec: <A>(input: SimpleExecInput<A>) => Effect.Effect<A, TerminalServiceError>;
  }
>()('@salesforce/vscode-services/v2/TerminalService') {}
