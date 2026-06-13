/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

// Schema for sf telemetry --json output
const SfTelemetryResultSchema = Schema.Struct({
  status: Schema.Number,
  result: Schema.Struct({
    cliId: Schema.String
  })
});

class FetchCliIdError extends Schema.TaggedError<FetchCliIdError>()('FetchCliIdError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

const fetchCliIdFromCli = () => {
  const command = 'sf telemetry --json';
  return Effect.tryPromise({
    try: async () => {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      return execAsync(command, { env: { ...process.env, NO_COLOR: '1' } });
    },
    catch: cause => new FetchCliIdError({ message: `Failed to run ${command}`, cause })
  }).pipe(
    Effect.tap(output => Effect.log(`sf telemetry output: ${output.stdout}`)),
    Effect.tapError(error => Effect.log(`sf telemetry error: ${String(error)}`)),
    Effect.flatMap(output => Schema.decodeUnknown(SfTelemetryResultSchema)(JSON.parse(output.stdout))),
    Effect.map(parsed => parsed.result.cliId),
    Effect.catchAll(error => Effect.log(`Failed to fetch cliId: ${String(error)}`).pipe(Effect.as(undefined))),
    Effect.withSpan('fetchCliId', { attributes: { command } })
  );
};

const cliIdEffect = process.env.ESBUILD_PLATFORM === 'web' ? Effect.succeed(undefined) : fetchCliIdFromCli();

// memo wrapper built once at module scope; the inner sf telemetry effect runs at most once per session and is shared across all getCliId() calls
const cachedCliId = Effect.runSync(Effect.cached(cliIdEffect));

/** Get the CLI ID from sf telemetry. Memoized at module scope so the CLI runs once per session. Returns undefined on web  */
export const getCliId = () => cachedCliId;
