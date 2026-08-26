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

import { defaultRunner, type CommandRunner } from './runner';

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

  const display = JSON.parse(runner('sf', ['org', 'display', '-o', orgAlias, '--json'])) as {
    result?: { instanceUrl?: string };
  };
  const instanceUrl = display.result?.instanceUrl;
  if (!instanceUrl) {
    throw new Error(`could not resolve instanceUrl for org "${orgAlias}" from \`sf org display\``);
  }

  // The dedicated command returns the REAL token; `org display` redacts it on recent CLI versions.
  const tokenResult = JSON.parse(runner('sf', ['org', 'auth', 'show-access-token', '-o', orgAlias, '--json'])) as {
    result?: { accessToken?: string } | string;
  };
  const accessToken = typeof tokenResult.result === 'object' ? tokenResult.result?.accessToken : undefined;
  if (!accessToken) {
    throw new Error(`could not resolve accessToken for org "${orgAlias}" from \`sf org auth show-access-token\``);
  }

  return { accessToken, instanceUrl };
};

/** Flatten a BootEnv into the `-e KEY=VALUE` env pairs the CB image expects at `docker run`. */
export const bootEnvToDockerArgs = (bootEnv: BootEnv): string[] => {
  const env: Record<string, string> = {
    SF_ACCESS_TOKEN: bootEnv.accessToken,
    INSTANCE_URL: bootEnv.instanceUrl,
    ...bootEnv.extraEnv
  };
  return Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
};
