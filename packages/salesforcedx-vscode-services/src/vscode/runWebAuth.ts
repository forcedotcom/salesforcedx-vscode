/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';

export const runWebAuthEffect = Effect.fn('runWebAuthEffect')(function* () {
  // Apply web config from esbuild define if present
  const webConfig = process.env.ESBUILD_WEB_CONFIG;
  if (webConfig && webConfig !== 'undefined' && isString(webConfig)) {
    const configMap = yield* Schema.decodeUnknownEffect(
      Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.fromJsonString)
    )(webConfig);
    const config = vscode.workspace.getConfiguration();
    yield* Effect.forEach(
      Object.entries(configMap),
      ([key, value]) =>
        Effect.promise(() => config.update(key, value, vscode.ConfigurationTarget.Workspace)).pipe(
          Effect.uninterruptible
        ),
      { discard: true }
    );
  }
});
