/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { env, execAsync } from './shared';

// `sf config get <single-key> --json` always returns exactly one element (the queried key), so model
// `result` as a 1-tuple and look the value up by key rather than relying on positional indexing.
type ConfigGetResult = { result: readonly [{ key: string; value?: string }] };

/**
 * Read the globally-configured target dev hub alias/username via `sf config get target-dev-hub --json`.
 * CI auths a dev hub with `--set-default-dev-hub` (alias `hub`); this returns that value so specs can
 * select it in the org picker without re-authorizing. Throws if no dev hub is configured.
 */
export const getTargetDevHub = async (): Promise<string> => {
  const { stdout } = await execAsync('sf config get target-dev-hub --json', { env });
  const value = (JSON.parse(stdout) as ConfigGetResult).result.find(r => r.key === 'target-dev-hub')?.value;
  if (!value) {
    throw new Error('No target-dev-hub configured (sf config get target-dev-hub returned no value).');
  }
  return value;
};
