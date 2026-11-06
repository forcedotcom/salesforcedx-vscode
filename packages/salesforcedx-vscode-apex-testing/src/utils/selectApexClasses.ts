/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { type ApexTestQuickPickItem } from './fileHelpers';

/** Prompt for the Apex classes to include in a suite. Fails with UserCancellationError on dismiss/empty. */
export const selectApexClasses = Effect.fn('apexTestSuite.selectApexClasses')(function* (
  apexClassItems: readonly ApexTestQuickPickItem[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showQuickPick<ApexTestQuickPickItem>(apexClassItems, { canPickMany: true })
  ).pipe(
    Effect.flatMap(promptService.considerEmptySelectionAsCancellation),
    Effect.map(selection => selection.map(item => item.fullClassName ?? item.label))
  );
});
