/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { VisualforceInitializationOptions } from './clientOptions';
import * as Effect from 'effect/Effect';
import { URI, Utils } from 'vscode-uri';

/**
 * Platform-branched language client factory. Dynamic imports keep node-only (`vscode-languageclient/node`,
 * IPC) code out of the web bundle and vice-versa; the branch is a build-time literal (`ESBUILD_PLATFORM`),
 * so esbuild's `define` collapses it and tree-shakes the other platform's module.
 */
export const createLanguageClient = Effect.fn('createLanguageClient')(function* (
  extensionUri: URI,
  initializationOptions: VisualforceInitializationOptions
) {
  const base = URI.from(extensionUri);
  if (process.env.ESBUILD_PLATFORM === 'web') {
    const webServerPath = Utils.joinPath(base, 'dist', 'web', 'visualforceServer.js').toString();
    const { createLanguageClient: createWebLanguageClient } = yield* Effect.promise(() => import('./web.js'));
    return yield* createWebLanguageClient(webServerPath, initializationOptions);
  }
  const nodeServerPath = Utils.joinPath(base, 'dist', 'visualforceServer.js').fsPath;
  const { createLanguageClient: createNodeLanguageClient } = yield* Effect.promise(() => import('./node.js'));
  return createNodeLanguageClient(nodeServerPath, initializationOptions);
});

export type { LanguageClientWorkerStartError } from './web';
