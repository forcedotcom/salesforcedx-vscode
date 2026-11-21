/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeServices from '@effect/platform-node/NodeServices';
import { GitHubLayer } from '@salesforce/effect-octokit';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { commandOutput } from './commandOutput.mts';

/** Use the same GitHub CLI authentication for API reads and artifact downloads. */
export const GitHubCliLive = Layer.unwrap(
  commandOutput({ executable: 'gh', args: ['auth', 'token', '--hostname', 'github.com'] }).pipe(
    Effect.map(({ stdout }) =>
      GitHubLayer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ GITHUB_TOKEN: stdout.trim() })))
      )
    ),
    Effect.provide(NodeServices.layer)
  )
);
