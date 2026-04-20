/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

export class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  command: Schema.String
}) {}

export class TerminalService extends Effect.Service<TerminalService>()('TerminalService', {
  accessors: false,
  effect: Effect.succeed({
    /** Execute a shell command and parse its stdout. Desktop-only; fails with TerminalServiceError on web. stdout is trimmed before parsing. */
    simpleExec: (command: string, parse: (stdout: string) => string = s => s) =>
      process.env.ESBUILD_PLATFORM === 'web'
        ? Effect.fail(new TerminalServiceError({ message: 'Not available on web', command }))
        : Effect.tryPromise({
            try: async () => {
              const { exec } = await import('node:child_process');
              const { promisify } = await import('node:util');
              return promisify(exec)(command, { timeout: 30_000 });
            },
            catch: e => new TerminalServiceError({ message: e instanceof Error ? e.message : 'exec failed', command })
          }).pipe(
            Effect.map(result => parse(result.stdout.trim())),
            Effect.withSpan('TerminalService.simpleExec', { attributes: { command } })
          )
  })
}) {}
