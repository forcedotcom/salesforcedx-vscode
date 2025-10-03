/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Scope from 'effect/Scope';

// eslint-disable-next-line functional/no-let
let extensionScope: Scope.CloseableScope | undefined;

export const getExtensionScope = (): Effect.Effect<Scope.CloseableScope, Error, never> =>
  Effect.gen(function* () {
    extensionScope ??= yield* Scope.make();
    return extensionScope;
  });

export const closeExtensionScope = (): Effect.Effect<void, Error, never> =>
  Effect.sync(() => {
    if (extensionScope) {
      Scope.close(extensionScope, Exit.void);
      extensionScope = undefined;
    }
  });
