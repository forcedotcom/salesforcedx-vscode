/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CliId, type OrgId } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { ConnectionHost } from './connectionHost.js';

export const UNAUTHENTICATED_USER = 'UNAUTHENTICATED_USER';
const TelemetryResult = Schema.fromJsonString(
  Schema.Struct({ status: Schema.Number, result: Schema.Struct({ cliId: CliId }) })
);
class FetchCliIdError extends Schema.TaggedError<FetchCliIdError>()('FetchCliIdError', {
  message: Schema.String,
  cause: Schema.Unknown
}) {}

/** The caller memoizes this in the connection layer, once per services runtime. */
export const fetchCliId = Effect.fn('fetchCliId')(function* () {
  if (process.env.ESBUILD_PLATFORM === 'web') return Option.none<CliId>();
  return yield* Effect.tryPromise({
    try: async signal => {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      return promisify(exec)('sf telemetry --json', { signal, env: { ...process.env, NO_COLOR: '1' } });
    },
    catch: cause => new FetchCliIdError({ message: 'Failed to run sf telemetry --json', cause })
  }).pipe(
    Effect.flatMap(output => Schema.decodeUnknownEffect(TelemetryResult)(output.stdout)),
    Effect.map(parsed => Option.some(parsed.result.cliId)),
    Effect.catchTag(['FetchCliIdError', 'SchemaError'], error =>
      Effect.logDebug('Failed to fetch cliId', error).pipe(Effect.as(Option.none<CliId>()))
    )
  );
});

export const setWebUserId = Effect.fn('setWebUserId')(function* (orgId: OrgId, userId: string) {
  const host = yield* ConnectionHost;
  const hash = yield* Effect.promise(() =>
    globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${orgId}-${userId}`))
  );
  const webUserId = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  yield* Effect.promise(() => host.globalState.update('telemetryWebUserId', webUserId));
  return webUserId;
});
