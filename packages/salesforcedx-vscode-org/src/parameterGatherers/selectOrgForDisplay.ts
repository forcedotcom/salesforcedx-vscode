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
import { buildOrgQuickPickItems, isOrgItem } from '../orgPicker/orgList';
import { getFreshAuthorizations } from '../util/orgUtil';

/** QuickPick that shows all authenticated orgs for the user to pick one to display info for. */
export const gatherOrgForDisplay = Effect.fn('SelectOrgForDisplay.gather')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const { defaultConfig, freshAuthorizations } = yield* getFreshAuthorizations();

  const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig);
  const selection = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_select_text'),
      matchOnDescription: true,
      matchOnDetail: true
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));

  if (!isOrgItem(selection) || !selection.orgUsername) {
    return yield* new api.services.UserCancellationError({});
  }

  return { username: selection.orgUsername };
});
