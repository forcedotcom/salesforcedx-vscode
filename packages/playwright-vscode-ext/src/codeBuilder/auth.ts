/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Org boot-env: the env the Code Builder image consumes at container start to log into an org
 * (its start-time sfdx-org-auth.sh reads SF_ACCESS_TOKEN + INSTANCE_URL). The lifecycle `run`/
 * `restart` inject this; how you obtain it is up to you.
 *
 * `resolveOrgBootEnv` is the OPTIONAL, `sf`-aware helper. It exists mainly to encapsulate one
 * hard-won lesson: read the access token from `sf org auth show-access-token`, NOT `sf org display`.
 * Recent CLI versions REDACT accessToken in `org display --json` (returning a "[REDACTED] Use 'sf
 * org auth show-access-token' ..." placeholder), so a container booted from that placeholder fails
 * its start-time login. Sourcing the real token here means the next adopter never re-hits it.
 *
 * NOTE: the container org model is an open question (plan §16 OQ3). Token injection is today's
 * baseline; this helper may be superseded by a different auth path later.
 */

import * as Schema from 'effect/Schema';
import { defaultRunner, type CommandRunner } from './runner';

/*
 * Schemas for the `sf --json` shapes we consume, validated at the boundary (TS standards / precedent
 * in manifest.ts) rather than trusted via `as` casts. Excess CLI fields are ignored; the fields we
 * read are optional here so a MISSING field yields a clean domain error below (not a decode failure).
 */
const OrgDisplayShape = Schema.Struct({
  result: Schema.optional(Schema.Struct({ instanceUrl: Schema.optional(Schema.String) }))
});
const ShowAccessTokenShape = Schema.Struct({
  // `result` can legitimately be null on this command (#7718), so allow NullOr, not just optional.
  result: Schema.Struct({ accessToken: Schema.optional(Schema.String) }).pipe(Schema.NullOr, Schema.optional)
});

/** The env keys the CB image reads at boot to authenticate an org, plus an escape hatch for extras. */
export type BootEnv = {
  /** Real org access token (from `sf org auth show-access-token`, not the redacted `org display`). */
  accessToken: string;
  /** Org instance URL. */
  instanceUrl: string;
  /** Any additional env the consumer wants injected at container start. */
  extraEnv?: Record<string, string>;
};

export type ResolveOrgBootEnvOptions = {
  /** Command runner (injectable for tests). Defaults to real `sf` via execFileSync. */
  runner?: CommandRunner;
};

/*
 * Produce the boot env for an org alias using the `sf` CLI. Two calls, because the two facts live in
 * two commands: instanceUrl from `org display`, and the (un-redacted) token from
 * `org auth show-access-token`.
 */
export const resolveOrgBootEnv = (orgAlias: string, options: ResolveOrgBootEnvOptions = {}): BootEnv => {
  const runner = options.runner ?? defaultRunner;

  /*
   * Parse `sf --json` stdout, but attach context on failure: if `sf` ever prints an update notice /
   * banner to stdout (the "hard-won" class of bug), a bare JSON.parse throws an opaque
   * "Unexpected token" with no clue which command or org. Rethrow with the argv + a stdout snippet.
   */
  const runSfJson = <A>(args: string[], schema: Schema.Schema<A>): A => {
    const out = runner('sf', args);
    let parsed: unknown;
    try {
      parsed = JSON.parse(out);
    } catch {
      // Slicing raw stdout at a byte offset can split a multi-byte UTF-8 char (e.g. an emoji in a
      // CLI banner), which JSON.stringify then renders as a replacement char. Strip non-printable-
      // ASCII from the snippet first so the diagnostic stays clean and readable.
      const snippet = out.slice(0, 200).replaceAll(/[^\x20-\x7E]/g, '?');
      throw new Error(`\`sf ${args.join(' ')}\` did not return JSON (stdout starts: ${JSON.stringify(snippet)})`);
    }
    // Validate the parsed shape at the boundary (schema, not `as`), so an unexpected `sf` output
    // shape fails loud here rather than surfacing as an undefined further down.
    return Schema.decodeUnknownSync(schema)(parsed);
  };

  const display = runSfJson(['org', 'display', '-o', orgAlias, '--json'], OrgDisplayShape);
  const instanceUrl = display.result?.instanceUrl;
  if (!instanceUrl) {
    throw new Error(`could not resolve instanceUrl for org "${orgAlias}" from \`sf org display\``);
  }

  // The dedicated command returns the REAL token; `org display` redacts it on recent CLI versions.
  // `sf org auth show-access-token --json` returns `{ result: { accessToken } }` (an object — the
  // #7718 workflow reads `.result.accessToken`); the schema allows a null result defensively.
  const tokenResult = runSfJson(['org', 'auth', 'show-access-token', '-o', orgAlias, '--json'], ShowAccessTokenShape);
  const accessToken = tokenResult.result?.accessToken;
  if (!accessToken) {
    throw new Error(`could not resolve accessToken for org "${orgAlias}" from \`sf org auth show-access-token\``);
  }

  return { accessToken, instanceUrl };
};

/** Flatten a BootEnv into the `-e KEY=VALUE` env pairs the CB image expects at `docker run`. */
export const bootEnvToDockerArgs = (bootEnv: BootEnv): string[] => {
  // extraEnv is spread FIRST so the resolved core keys (SF_ACCESS_TOKEN/INSTANCE_URL) always win —
  // an escape-hatch extraEnv can't silently clobber the org credentials the image boots from.
  const env: Record<string, string> = {
    ...bootEnv.extraEnv,
    SF_ACCESS_TOKEN: bootEnv.accessToken,
    INSTANCE_URL: bootEnv.instanceUrl
  };
  return Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
};
