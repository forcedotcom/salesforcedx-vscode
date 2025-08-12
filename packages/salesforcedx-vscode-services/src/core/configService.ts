/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { Context, Effect, Layer, pipe } from 'effect';
// import * as vscode from 'vscode';
// import { URI } from 'vscode-uri';
import { fsPrefix } from '../virtualFsProvider/constants';
import { WorkspaceService } from '../vscode/workspaceService';

export type ConfigService = {
  /** Get a ConfigAggregator for the current workspace */
  readonly getConfigAggregator: Effect.Effect<ConfigAggregator, Error, WorkspaceService>;
};

export const ConfigService = Context.GenericTag<ConfigService>('ConfigService');

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.sync(() => ({
    getConfigAggregator: pipe(
      WorkspaceService,
      Effect.flatMap(ws => ws.getWorkspaceInfo),
      Effect.flatMap(workspaceDescription =>
        workspaceDescription.isEmpty
          ? Effect.fail(new Error('No workspace project path found'))
          : Effect.succeed(workspaceDescription.path.replace(fsPrefix, '').replace(':/', ''))
      ),
      Effect.tap(projectPath => console.log('WSPath', JSON.stringify(projectPath, null, 2))),
      Effect.flatMap(projectPath =>
        Effect.tryPromise({
          try: () => ConfigAggregator.create({ projectPath }),
          catch: (error: unknown) => new Error(`Failed to get ConfigAggregator: ${String(error)}`)
        })
      )
    )
  }))
);
