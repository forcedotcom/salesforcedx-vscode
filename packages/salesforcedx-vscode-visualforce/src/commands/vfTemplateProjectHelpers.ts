/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, parseErrorToValidationMessage } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../messages';

const VF_NAME_MAX_LENGTH = 40;

const VfTypeNameSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => nls.localize('name_empty_error') }),
  Schema.maxLength(VF_NAME_MAX_LENGTH, { message: () => nls.localize('name_max_length_error', VF_NAME_MAX_LENGTH) }),
  Schema.pattern(/^[A-Za-z]([A-Za-z0-9]*(_[A-Za-z0-9]+)*)?$/, { message: () => nls.localize('name_format_error') })
);

// VF names: start with letter, alphanumeric+underscore only, no trailing underscore,
// no consecutive underscores. Stricter than Apex class names.
// Reference: https://salesforce.stackexchange.com/questions/155078/name-error-in-visualforce-page
const validateVfTypeName = (value: string): string | undefined =>
  Schema.decodeUnknownEither(VfTypeNameSchema)(value).pipe(parseErrorToValidationMessage);

export const promptForVfTypeName = Effect.fn('promptForVfTypeName')(function* (prompt: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt,
      validateInput: validateVfTypeName
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});
