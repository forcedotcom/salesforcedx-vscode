/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { ChildProcess } from './childProcess';

export class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  command: Schema.String
}) {}

export class TerminalService extends Effect.Service<TerminalService>()('TerminalService', {
  accessors: false,
  dependencies: [ChildProcess.Default],
  effect: Effect.gen(function* () {
    const childProcess = yield* ChildProcess;
    return {
      /** Execute a shell command and parse its stdout. Desktop-only; fails with TerminalServiceError on web. stdout is trimmed before parsing.
       * `timeout` (default 30s) bounds the child process; pass a larger Duration for long-running commands (e.g. org delete).
       * `env` overrides/augments the child's environment (merged over `process.env` in childProcess); use for flags like
       * `SF_JSON_TO_STDOUT=true` that keep JSON stdout clean. */
      simpleExec: Effect.fn('TerminalService.simpleExec')(function* <A>({
        command,
        parse,
        timeout = Duration.millis(30_000),
        env
      }: {
        command: string;
        parse: (stdout: string) => A;
        timeout?: Duration.DurationInput;
        env?: Record<string, string>;
      }) {
        yield* Effect.annotateCurrentSpan('command', command);
        // annotate which env keys were overridden (keys only — never values, to avoid leaking secrets)
        if (env) yield* Effect.annotateCurrentSpan('envKeys', Object.keys(env));
        if (process.env.ESBUILD_PLATFORM === 'web') {
          return yield* Effect.fail(new TerminalServiceError({ message: 'Not available on web', command }));
        }
        const result = yield* Effect.tryPromise({
          // signal is the runtime AbortSignal; threading it into exec lets a fiber interrupt kill the child
          try: signal => childProcess.exec(command, { timeout: Duration.toMillis(timeout), signal, env }),
          catch: e => new TerminalServiceError({ message: e instanceof Error ? e.message : 'exec failed', command })
        });
        return parse(result.stdout.trim());
      })
    };
  })
}) {}
