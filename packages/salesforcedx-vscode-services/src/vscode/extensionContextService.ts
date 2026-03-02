/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { ExtensionContext } from 'vscode';
import { getExtensionContext } from './extensionContext';

export class ExtensionContextNotAvailableError extends Data.TaggedError('ExtensionContextNotAvailableError')<{}> {}

/**
 * Service providing access to VS Code ExtensionContext.
 * Use ExtensionContextServiceLayer to provide the context.
 * Default falls back to the services extension's context when set.
 */
export class ExtensionContextService extends Effect.Service<ExtensionContextService>()('ExtensionContextService', {
  sync: (): {
    getContext: Effect.Effect<ExtensionContext, ExtensionContextNotAvailableError>;
    getDisplayName: Effect.Effect<string, ExtensionContextNotAvailableError>;
  } => ({
    getContext: getExtensionContext(),
    getDisplayName: Effect.gen(function* () {
      const ctx = yield* getExtensionContext();
      return ctx.extension.packageJSON.displayName;
    })
  })
}) {}

/**
 * Factory for a Layer that provides an ExtensionContextService for the given context.
 * Use this in extensions to provide their context.
 * Usage:
 * Layer.provide(ExtensionContextServiceLayer(context))
 */
export const ExtensionContextServiceLayer = (context: ExtensionContext): Layer.Layer<ExtensionContextService> =>
  Layer.succeed(
    ExtensionContextService,
    new ExtensionContextService({
      getContext: Effect.succeed(context),
      getDisplayName: Effect.succeed(context.extension.packageJSON.displayName)
    })
  );
