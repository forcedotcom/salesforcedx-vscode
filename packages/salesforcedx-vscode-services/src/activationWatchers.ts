/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { makeScopedFibers } from './services/scopedFiber';
import { watchRetrieveOnLoadSetting } from './vscode/configWatcher';
import { watchDefaultOrgContext } from './vscode/context';
import { watchEsrDecomposedContext, watchMuleDxApiInactiveContext } from './vscode/contextKeyWatchers';
import { watchApexTestContext, watchPackageDirectoriesContext } from './vscode/editorContext';
import { watchLwcAuraExtensionActivation } from './vscode/extensionActivator';

/** Context/activation watchers consume the acquired domain graph; file/auth/project watchers stay in their existing layers. */
export const ActivationWatchersLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const fibers = yield* makeScopedFibers;
    yield* Effect.all(
      [
        watchDefaultOrgContext().pipe(fibers.fork),
        watchPackageDirectoriesContext().pipe(fibers.fork),
        watchApexTestContext().pipe(fibers.fork),
        watchLwcAuraExtensionActivation().pipe(fibers.fork),
        watchMuleDxApiInactiveContext().pipe(fibers.fork),
        watchEsrDecomposedContext().pipe(fibers.fork),
        watchRetrieveOnLoadSetting().pipe(fibers.fork)
      ],
      { concurrency: 'unbounded', discard: true }
    );
  })
);
