/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { GitHub } from '@salesforce/effect-octokit';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { commandOutput } from './commandOutput.mts';

/** Use the same GitHub CLI authentication for API reads and artifact downloads. */
export const GitHubCliLive = Layer.unwrapEffect(
  commandOutput({ executable: 'gh', args: ['auth', 'token', '--hostname', 'github.com'] }).pipe(
    Effect.map(({ stdout }) =>
      GitHub.Default.pipe(
        Layer.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map([['GITHUB_TOKEN', stdout.trim()]]))))
      )
    ),
    Effect.provide(NodeContext.layer)
  )
);
