/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
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
/** Deploy/retrieve partial failures already log details via formatDeployOutput/formatRetrieveOutput; avoid duplicating the summary in the channel. */
const isMetadataCompletedWithErrorsSummaryError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('_tag' in error)) return false;
  const tag = Reflect.get(error, '_tag');
  return (
    tag === 'DeployCompletedWithErrorsError' || tag === 'RetrieveCompletedWithErrorsError'
  );
};

const getBaseMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const innerCause = hasCause(error) ? error.cause : undefined;
    return innerCause instanceof Error ? getBaseMessage(innerCause) : error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = Reflect.get(error, 'message');
    if (typeof msg === 'string') return msg;
  }
  return String(error);
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
 * Logs the error message to the output channel except for deploy/retrieve completed-with-errors (details are already in the channel).
 * When errors have actions (like SfError), also shows a "View Details" button.
 */
export class ErrorHandlerService extends Effect.Service<ErrorHandlerService>()('ErrorHandlerService', {
  effect: Effect.gen(function* () {
    const channelService = yield* ChannelService;
    return {
      /** Handle a Cause by showing error notification - use with Effect.catchAllCause */
      handleCause: (cause: Cause.Cause<unknown>) =>
        Effect.gen(function* () {
          const error = Cause.squash(cause);
          const baseMessage = getBaseMessage(error);
          const actions = getActions(error);

          if (actions.length > 0) {
            const fullMessage = `Error: ${baseMessage}\n\n${actions.join('\n')}`;
            yield* channelService.appendToChannel(fullMessage);
            const channel = yield* channelService.getChannel;
            const viewSuggestions = nls.localize('view_suggestions');
            const selection = yield* Effect.promise(() => vscode.window.showErrorMessage(baseMessage, viewSuggestions));
            if (selection === viewSuggestions) channel.show();
          } else {
            if (!isMetadataCompletedWithErrorsSummaryError(error)) {
              yield* channelService.appendToChannel(baseMessage);
            }
            yield* Effect.sync(() => void vscode.window.showErrorMessage(baseMessage));
          }
        })
    };
  })
}) {}
