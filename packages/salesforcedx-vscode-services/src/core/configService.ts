/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core';
import { Context, Effect, Layer } from 'effect';
import * as Option from 'effect/Option';
import { WorkspaceService } from '../vscode/workspaceService';

export type ConfigService = {
  /** Get a ConfigAggregator for the current workspace */
  readonly getConfigAggregator: Effect.Effect<ConfigAggregator, Error, WorkspaceService>;
};

export const ConfigService = Context.GenericTag<ConfigService>('ConfigService');

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.sync(() => ({
    getConfigAggregator: Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const maybePath = yield* ws.getWorkspacePath;
      if (Option.isNone(maybePath)) return yield* Effect.fail(new Error('No workspace project path found'));
      const projectPath = maybePath.value;
      return yield* Effect.tryPromise({
        try: () => ConfigAggregator.create({ projectPath }),
        catch: (error: unknown) => new Error(`Failed to get ConfigAggregator: ${String(error)}`)
      });
    })
  }))
);
