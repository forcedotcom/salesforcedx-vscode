/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { UserCancellationError } from './prompts/metadataOverwrite';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as vscode from 'vscode';
import { ErrorHandlerService } from './errorHandlerService';
import { ExtensionContextService } from './extensionContextService';

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
  <E, A>(command: string, f: (...args: any[]) => Effect.Effect<A, E | UserCancellationError, LayerR>) =>
    Effect.gen(function* () {
      const contextService = yield* ExtensionContextService;
      const context = yield* contextService.getContext;
      const errorHandler = yield* ErrorHandlerService;
      context.subscriptions.push(
        vscode.commands.registerCommand(command, (...args) =>
          Effect.runFork(
            f(...args).pipe(
              // root: true ensures proper trace root (not orphaned child of activation)
              Effect.withSpan(command, { attributes: { command, args }, root: true }),
              Effect.catchTag('UserCancellationError', () => Effect.void),
              Effect.catchAllCause(cause => errorHandler.handleCause(cause)),
              Effect.provide(layer)
            )
          )
        )
      );
    }).pipe(Effect.withSpan(`registerCommand:${command}`));

/**
 * Factory that creates a registerCommand function pre-loaded with a ManagedRuntime.
 * Prefer over registerCommandWithLayer when the extension has a runtime; fibers are
 * tracked by the runtime for proper shutdown and share its tracer/logger.
 *
 * @example
 * const registerCommand = registerCommandWithRuntime(getRuntime());
 * yield* registerCommand('sf.my.command', myCommandEffect);
 */
export const registerCommandWithRuntime =
  <R, RuntimeE>(runtime: ManagedRuntime.ManagedRuntime<R, RuntimeE>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- This really is that generic, Effect will handle the param stuff
  <E, A>(command: string, f: (...args: any[]) => Effect.Effect<A, E | UserCancellationError, R>) =>
    Effect.gen(function* () {
      const contextService = yield* ExtensionContextService;
      const context = yield* contextService.getContext;
      const errorHandler = yield* ErrorHandlerService;
      context.subscriptions.push(
        vscode.commands.registerCommand(command, (...args) =>
          runtime.runFork(
            f(...args).pipe(
              Effect.withSpan(command, { attributes: { command, args }, root: true }),
              Effect.catchTag('UserCancellationError', () => Effect.void),
              Effect.catchAllCause(cause => errorHandler.handleCause(cause))
            )
          )
        )
      );
    }).pipe(Effect.withSpan(`registerCommand:${command}`));
