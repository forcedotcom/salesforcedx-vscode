/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Rec from 'effect/Record';
import * as vscode from 'vscode';
import { SettingsService } from './settingsService';

export const runWebAuthEffect = Effect.fn('runWebAuthEffect')(function* () {
  // Apply web config from esbuild define if present
  const webConfig = process.env.ESBUILD_WEB_CONFIG;
  if (webConfig && webConfig !== 'undefined' && isString(webConfig)) {
    const parseConfig = (): Record<string, unknown> | undefined => {
      const parsed = JSON.parse(webConfig);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    };
    const configMap = parseConfig();

    if (configMap) {
      const settings = yield* SettingsService;
      yield* Effect.all(
        Rec.collect(configMap, (fullKey, value) => {
          const dot = fullKey.indexOf('.');
          if (dot === -1) {
            return Effect.promise(() =>
              vscode.workspace.getConfiguration().update(fullKey, value, vscode.ConfigurationTarget.Workspace)
            );
          }
          return settings.setValue(
            fullKey.slice(0, dot),
            fullKey.slice(dot + 1),
            value,
            vscode.ConfigurationTarget.Workspace
          );
        })
      );
    }
  }
});
