/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { ErrorHandlerService } from './errorHandlerService';
import { ExtensionContextService } from './extensionContextService';

// TODO: command cancellation...where is that handled?  From inside the effect?  If so, let's create a pattern for it.

/**
 * Factory that creates a registerCommand function pre-loaded with a layer.
 * This ensures command spans are created by the same tracer that handles children.
 *
 * @example
 * const registerCommand = registerCommandWithLayer(AllServicesLayer);
 * yield* registerCommand('sf.my.command', myCommandEffect);
 */
export const registerCommandWithLayer =
  <LayerR, LayerE>(layer: Layer.Layer<LayerR, LayerE, never>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- This really is that generic, Effect will handle the param stuff
  <E, A>(command: string, f: (...args: any[]) => Effect.Effect<A, E, LayerR>) =>
    Effect.gen(function* () {
      const contextService = yield* ExtensionContextService;
      const context = yield* contextService.getContext;
      const errorHandler = yield* ErrorHandlerService;
      context.subscriptions.push(
        vscode.commands.registerCommand(command, (...args) =>
          Effect.runPromise(
            f(...args).pipe(
              // root: true ensures proper trace root (not orphaned child of activation)
              Effect.withSpan(command, { attributes: { command, args }, root: true }),
              // fork the error handler so it doesn't block the command but does show the message
              Effect.catchAllCause(cause => errorHandler.handleCause(cause)),
              Effect.provide(layer)
            )
          )
        )
      );
    }).pipe(Effect.withSpan(`registerCommand:${command}`));
