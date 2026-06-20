/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

export class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  command: Schema.String
}) {}

export class TerminalService extends Effect.Service<TerminalService>()('TerminalService', {
  accessors: false,
  effect: Effect.succeed({
    /** Execute a shell command and parse its stdout. Desktop-only; fails with TerminalServiceError on web. stdout is trimmed before parsing.
     * `timeout` (default 30s) bounds the child process; pass a larger Duration for long-running commands (e.g. org delete). */
    simpleExec: Effect.fn('TerminalService.simpleExec')(function* <A>({
      command,
      parse,
      timeout = Duration.millis(30_000)
    }: {
      command: string;
      parse: (stdout: string) => A;
      timeout?: Duration.DurationInput;
    }) {
      yield* Effect.annotateCurrentSpan('command', command);
      if (process.env.ESBUILD_PLATFORM === 'web') {
        return yield* Effect.fail(new TerminalServiceError({ message: 'Not available on web', command }));
      }
      const result = yield* Effect.tryPromise({
        try: async signal => {
          const { exec } = await import('node:child_process');
          const { promisify } = await import('node:util');
          return promisify(exec)(command, { timeout: Duration.toMillis(timeout), signal });
        },
        catch: e => new TerminalServiceError({ message: e instanceof Error ? e.message : 'exec failed', command })
      });
      return parse(result.stdout.trim());
    })
  })
}) {}
