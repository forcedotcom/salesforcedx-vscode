/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { UserCancellationError } from './prompts/promptService';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Runtime from 'effect/Runtime';
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
  // _layer: phantom parameter for LayerR type inference; runtime captured from ambient context
  <LayerR, LayerE>(_layer: Layer.Layer<LayerR, LayerE, never>) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- This really is that generic, Effect will handle the param stuff
    <E, A>(command: string, f: (...args: any[]) => Effect.Effect<A, E | UserCancellationError, LayerR>) =>
      Effect.gen(function* () {
        const contextService = yield* ExtensionContextService;
        const context = yield* contextService.getContext;
        const errorHandler = yield* ErrorHandlerService;
        // Capture ambient runtime. Effect.runtime<LayerR>() avoids re-providing the layer on each invocation,
        // which would rebuild Layer.effect resources (e.g., re-registering VS Code commands).
        const runtime = yield* Effect.runtime<LayerR>();
        context.subscriptions.push(
          vscode.commands.registerCommand(command, (...args) =>
            Runtime.runFork(runtime)(
              f(...args).pipe(
                // root: true ensures proper trace root (not orphaned child of activation)
                Effect.withSpan(command, { attributes: { command, args }, root: true }),
                Effect.catchTag('UserCancellationError', () => Effect.void),
                Effect.catchAllCause(cause => errorHandler.handleCause(cause))
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
