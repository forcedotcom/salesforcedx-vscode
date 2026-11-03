/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, parseErrorToValidationMessage } from '@salesforce/effect-ext-utils';
import { hasFileNameCollision } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../messages';

const LwcComponentNameSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => nls.localize('lwc_component_name_empty_error') }),
  Schema.pattern(/^[a-z][A-Za-z0-9_]*$/, { message: () => nls.localize('lwc_component_name_format_error') })
);

export type PromptForLwcNameOptions = {
  /** Project-wide LWC + Aura component names (lowercase) for cross-bundle collision detection. */
  readonly existingNames: ReadonlySet<string>;
  /** When set, the input box is pre-filled with this value (rename flow). */
  readonly initialValue?: string;
  /** When set, validates against bundle-internal file-name collisions (rename flow). */
  readonly bundleFileNames?: readonly string[];
};

export const validateLwcName = (value: string, opts: PromptForLwcNameOptions) => {
  const trimmed = value.trim();
  const decoded = Schema.decodeUnknownEither(LwcComponentNameSchema)(trimmed);
  const validationMessage = decoded.pipe(parseErrorToValidationMessage);
  if (isNotUndefined(validationMessage)) return validationMessage;
  if (opts.existingNames.has(trimmed.toLowerCase())) return nls.localize('component_input_dup_error');
  if (opts.bundleFileNames && hasFileNameCollision(opts.bundleFileNames, trimmed)) {
    return nls.localize('rename_component_input_dup_file_name_error');
  }
  return undefined;
};

export const promptForLwcName = Effect.fn('promptForLwcName')(function* (opts: PromptForLwcNameOptions) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      value: opts.initialValue,
      prompt: nls.localize('lwc_component_name_prompt'),
      placeHolder: nls.localize('lwc_component_name_placeholder'),
      validateInput: (value: string) => validateLwcName(value, opts)
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});
