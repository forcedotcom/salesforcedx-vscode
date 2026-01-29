/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { ChannelService } from './channelService';

/** Type guard for errors with actions array (e.g., SfError) */
const hasActions = (e: unknown): e is { actions: string[] } =>
  typeof e === 'object' && e !== null && 'actions' in e && Array.isArray(e.actions);

/** Type guard for errors with a cause property */
const hasCause = (e: unknown): e is { cause: unknown } => typeof e === 'object' && e !== null && 'cause' in e;

/** Recursively extract actions from error chain */
const getActions = (error: unknown): string[] => {
  if (!(error instanceof Error)) return [];
  const actions = hasActions(error) ? error.actions.filter(Boolean) : [];
  const innerCause = hasCause(error) ? error.cause : undefined;
  const causeActions = innerCause instanceof Error ? getActions(innerCause) : [];
  return [...actions, ...causeActions];
};

/** Get the base error message, preferring inner cause message */
const getBaseMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const innerCause = hasCause(error) ? error.cause : undefined;
  return innerCause instanceof Error ? getBaseMessage(innerCause) : error.message;
};

/**
 * Extract a user-friendly error message from an error.
 * Handles SfError actions and nested cause chains.
 */
export const getErrorMessage = (error: unknown): string => {
  const baseMessage = getBaseMessage(error);
  const actions = getActions(error);
  const actionText = actions.join('\n');
  return actionText ? `${baseMessage}\n\n${actionText}` : baseMessage;
};

/**
 * Service for handling errors in commands and effects.
 * Shows error notifications to the user via VS Code's notification system.
 * When errors have actions (like SfError), logs details to output channel
 * and shows a "View Details" button.
 */
export class ErrorHandlerService extends Effect.Service<ErrorHandlerService>()('ErrorHandlerService', {
  effect: Effect.gen(function* () {
    const channelService = yield* ChannelService;
    return {
      /** Handle a Cause by showing error notification - use with Effect.catchAllCause */
      handleCause: (cause: Cause.Cause<unknown>) =>
        Effect.gen(function* () {
          console.error(cause);
          const error = Cause.squash(cause);
          const baseMessage = getBaseMessage(error);
          const actions = getActions(error);

          if (actions.length > 0) {
            const fullMessage = `Error: ${baseMessage}\n\n${actions.join('\n')}`;
            yield* channelService.appendToChannel(fullMessage);
            const channel = yield* channelService.getChannel;
            const selection = yield* Effect.promise(() =>
              vscode.window.showErrorMessage(baseMessage, 'View Details')
            );
            if (selection === 'View Details') channel.show();
          } else {
            yield* Effect.sync(() => void vscode.window.showErrorMessage(baseMessage));
          }
        })
    };
  }),
  dependencies: [ChannelService.Default]
}) {}
