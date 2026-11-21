/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as ChildProcess from 'effect/process/ChildProcess';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';

class CommandFailed extends Schema.TaggedError<CommandFailed>()('CommandFailed', {
  command: Schema.String,
  exitCode: Schema.Number,
  message: Schema.String
}) {}

export const commandFailed = (executable: string, args: readonly string[], exitCode: number, stderr: string) => {
  const command = JSON.stringify([executable, ...args]);
  const detail = stderr.trim();
  return new CommandFailed({
    command,
    exitCode,
    message:
      detail.length === 0
        ? `${command} exited with code ${exitCode}`
        : `${command} exited with code ${exitCode}: ${detail}`
  });
};

export const commandOutput = Effect.fn('commandOutput')(function* ({
  executable,
  args,
  cwd,
  env,
  extendEnv
}: {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly extendEnv?: boolean;
}) {
  const [exitCode, stdout, stderr] = yield* ChildProcess.make(executable, args, { cwd, env, extendEnv }).pipe(
    Effect.flatMap(process =>
      Effect.all(
        [
          process.exitCode,
          process.stdout.pipe(Stream.decodeText, Stream.mkString),
          process.stderr.pipe(Stream.decodeText, Stream.mkString)
        ],
        { concurrency: 'unbounded' }
      )
    ),
    Effect.scoped
  );
  if (exitCode !== 0) return yield* commandFailed(executable, args, Number(exitCode), stderr);
  return { stdout, stderr };
});
