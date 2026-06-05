/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { hasFileNameCollision } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';

export type PromptForAuraNameOptions = {
  /** Project-wide LWC + Aura component names (lowercase) for cross-bundle collision detection. */
  readonly existingNames?: ReadonlySet<string>;
  /** When set, the input box is pre-filled with this value (rename flow). */
  readonly initialValue?: string;
  /** When set, validates against bundle-internal file-name collisions (rename flow). */
  readonly bundleFileNames?: readonly string[];
};

export const promptForAuraName = Effect.fn('promptForAuraName')(function* (opts: PromptForAuraNameOptions = {}) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      value: opts.initialValue,
      prompt: nls.localize('aura_component_name_prompt'),
      validateInput: (value: string) => {
        const trimmed = value?.trim();
        if (!trimmed) return nls.localize('aura_component_name_empty_error');
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) return nls.localize('aura_component_name_format_error');
        if (opts.existingNames?.has(trimmed.toLowerCase())) return nls.localize('component_input_dup_error');
        if (opts.bundleFileNames && hasFileNameCollision(opts.bundleFileNames, trimmed)) {
          return nls.localize('rename_component_input_dup_file_name_error');
        }
        return undefined;
      }
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});
