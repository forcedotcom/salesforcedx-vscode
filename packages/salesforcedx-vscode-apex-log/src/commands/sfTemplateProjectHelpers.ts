/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';

const APEX_NAME_MAX_LENGTH = 40;

type ApexTypeNameMessages = {
  readonly empty: string;
  readonly invalidFormat: string;
  readonly maxLength: string;
  readonly reservedDefault: string;
};

const getStandardApexTypeNameMessages = () => ({
  empty: nls.localize('name_empty_error'),
  invalidFormat: nls.localize('name_format_error'),
  maxLength: nls.localize('name_max_length_error', APEX_NAME_MAX_LENGTH),
  reservedDefault: nls.localize('name_cannot_be_default')
});

const validateApexTypeName = (
  value: string,
  messages: ApexTypeNameMessages,
  options?: { readonly maxLength?: number }
): string | undefined => {
  const maxLen = options?.maxLength ?? APEX_NAME_MAX_LENGTH;
  if (!value || value.trim().length === 0) return messages.empty;
  if (value.toLowerCase() === 'default') return messages.reservedDefault;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return messages.invalidFormat;
  return value.length > maxLen ? messages.maxLength : undefined;
};

type PromptForApexTypeNameParams = {
  readonly prompt: string;
  readonly messages?: ApexTypeNameMessages;
};

export const promptForApexTypeName = Effect.fn('promptForApexTypeName')(function* (
  params: PromptForApexTypeNameParams
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const messages = params.messages ?? getStandardApexTypeNameMessages();
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: params.prompt,
      validateInput: (value: string) =>
        validateApexTypeName(value, messages, {
          maxLength: APEX_NAME_MAX_LENGTH
        })
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});
