/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { exec } from 'node:child_process';

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
    try: () =>
      new Promise<string>((resolve, reject) => {
        exec(command, (error, stdout) => (error ? reject(error) : resolve(stdout)));
      }),
    catch: e => e
  }).pipe(
    Effect.flatMap(output => Schema.decodeUnknown(SfTelemetryResultSchema)(JSON.parse(output))),
    Effect.map(parsed => parsed.result.cliId),
    Effect.catchAll(error => Effect.log(`Failed to fetch cliId: ${String(error)}`).pipe(Effect.as(undefined))),
    Effect.withSpan('fetchCliId', { attributes: { command } })
  );
};

/** Get the CLI ID from sf telemetry. Cached permanently. Returns undefined on web  */
export const getCliId = () =>
  (process.env.ESBUILD_PLATFORM === 'web' ? Effect.succeed(undefined) : fetchCliIdFromCli()).pipe(Effect.cached);
