/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Schema for sf telemetry --json output
const SfTelemetryResultSchema = Schema.Struct({
  status: Schema.Number,
  result: Schema.Struct({
    cliId: Schema.String
  })
});

const fetchCliIdFromCli = () => {
  const command = 'sf telemetry --json';
  return Effect.tryPromise({
    try: () => execAsync(command, { env: { ...process.env, NO_COLOR: '1' } }),
    catch: e => e
  }).pipe(
    Effect.tap(output => Effect.log(`sf telemetry output: ${output.stdout}`)),
    Effect.tapError(error => Effect.log(`sf telemetry error: ${String(error)}`)),
    Effect.flatMap(output => Schema.decodeUnknown(SfTelemetryResultSchema)(JSON.parse(output.stdout))),
    Effect.map(parsed => parsed.result.cliId),
    Effect.catchAll(error => Effect.log(`Failed to fetch cliId: ${String(error)}`).pipe(Effect.as(undefined))),
    Effect.withSpan('fetchCliId', { attributes: { command } })
  );
};

/** Get the CLI ID from sf telemetry. Cached permanently. Returns undefined on web  */
export const getCliId = () =>
  (process.env.ESBUILD_PLATFORM === 'web' ? Effect.succeed(undefined) : fetchCliIdFromCli()).pipe(Effect.cached);
