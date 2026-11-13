/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, ErrorHandlerService } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isError, isObject, isString } from 'effect/Predicate';
import * as vscode from 'vscode';

export type ErrorHandlerMessages = {
  readonly orgOperationSuperseded: string;
  readonly viewSuggestions: string;
};

const hasActions = (error: unknown): error is { actions: string[] } =>
  isObject(error) && 'actions' in error && Array.isArray(error.actions);
const hasCause = (error: unknown): error is { cause: unknown } => isObject(error) && 'cause' in error;
const getActions = (error: unknown): string[] => {
  if (!isError(error)) return [];
  const actions = hasActions(error) ? error.actions.filter(Boolean) : [];
  const innerCause = hasCause(error) ? error.cause : undefined;
  return [...actions, ...(isError(innerCause) ? getActions(innerCause) : [])];
};
const getBaseMessage = (error: unknown): string => {
  if (isError(error)) {
    const innerCause = hasCause(error) ? error.cause : undefined;
    return isError(innerCause) ? getBaseMessage(innerCause) : error.message;
  }
  if (isObject(error) && 'message' in error) {
    const message = Reflect.get(error, 'message');
    if (isString(message)) return message;
  }
  return String(error);
};

/** Preserve native SfError action chains and the innermost error message. */
export const getErrorMessage = (error: unknown): string => {
  const message = getBaseMessage(error);
  const actions = getActions(error).join('\n');
  return actions ? `${message}\n\n${actions}` : message;
};

/** Bind localized UI strings, then supply the caller's channel when building its layer. */
export const makeErrorHandlerServiceLayer = (messages: ErrorHandlerMessages) =>
  Layer.effect(
    ErrorHandlerService,
    Effect.gen(function* () {
      const channel = yield* ChannelService;
      const handleCause = Effect.fn('ErrorHandlerService.handleCause')(function* (cause: Cause.Cause<unknown>) {
        const error = Cause.squash(cause);
        const message = getBaseMessage(error);
        const actions = getActions(error);
        const tag = isObject(error) && '_tag' in error ? Reflect.get(error, '_tag') : undefined;
        const prefix = isString(tag) ? `[${tag}] ` : '';
        if (tag === 'InactiveOrgOperationError') {
          yield* channel.appendToChannel(`${prefix}${message}`);
          yield* Effect.sync(() => {
            void vscode.window.showInformationMessage(messages.orgOperationSuperseded);
          });
          return;
        }
        if (actions.length > 0) {
          yield* channel.appendToChannel(`${prefix}Error: ${message}\n\n${actions.join('\n')}`);
          const output = yield* channel.getChannel;
          const selected = yield* Effect.promise(() =>
            vscode.window.showErrorMessage(message, messages.viewSuggestions)
          );
          if (selected === messages.viewSuggestions) output.show();
        } else {
          if (tag !== 'DeployCompletedWithErrorsError' && tag !== 'RetrieveCompletedWithErrorsError') {
            yield* channel.appendToChannel(`${prefix}${message}`);
          }
          yield* Effect.sync(() => {
            void vscode.window.showErrorMessage(message);
          });
        }
      });
      return ErrorHandlerService.of({ handleCause });
    })
  );
