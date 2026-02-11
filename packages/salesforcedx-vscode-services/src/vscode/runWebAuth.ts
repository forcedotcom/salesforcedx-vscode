/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

export const runWebAuthEffect = Effect.fn('runWebAuthEffect')(function* () {
  // Apply web config from esbuild define if present
  const webConfig = process.env.ESBUILD_WEB_CONFIG;
  console.log('ESBUILD_WEB_CONFIG raw:', webConfig);
  if (webConfig && webConfig !== 'undefined' && typeof webConfig === 'string') {
    const parseConfig = (): Record<string, unknown> | undefined => {
      const parsed = JSON.parse(webConfig);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    };
    const configMap = parseConfig();
    console.log('ESBUILD_WEB_CONFIG parsed:', configMap);

    if (configMap) {
      const config = vscode.workspace.getConfiguration();
      yield* Effect.all(
        Object.entries(configMap).map(([k, v]) =>
          Effect.promise(() => {
            console.log(`Setting config: ${k} = ${typeof v === 'string' ? v.substring(0, 50) : v}`);
            return config.update(k, v, vscode.ConfigurationTarget.Global);
          })
        )
      );
    }
  }
});
