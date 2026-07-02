/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgAuthorization } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../orgPicker/orgList';
import { getFreshAuthorizations } from '../util/orgUtil';

export type OrgToDelete = { username: string; orgType: 'scratch' | 'sandbox' };

const isDeletable = (org: OrgAuthorization): boolean => org.isScratchOrg === true || org.isSandbox === true;

/** Multi-select QuickPick filtered to scratch orgs and sandboxes with a delete confirmation. */
export const gather = Effect.fn('SelectDeletableOrg.gather')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const { defaultConfig, freshAuthorizations } = yield* getFreshAuthorizations();

  const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig, isDeletable);
  const selections = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_delete_select_orgs_placeholder'),
      canPickMany: true,
      matchOnDescription: true,
      matchOnDetail: true
    })
  ).pipe(Effect.flatMap(promptService.considerEmptySelectionAsCancellation));

  const targetOrgs: OrgToDelete[] = selections.filter(isOrgItem).flatMap(s => {
    if (!s.orgUsername) return [];
    const auth = freshAuthorizations.find(o => o.username === s.orgUsername);
    const orgType = auth?.isScratchOrg === true ? 'scratch' : 'sandbox';
    return [{ username: s.orgUsername, orgType }];
  });

  if (targetOrgs.length === 0) {
    return yield* new api.services.UserCancellationError({});
  }

  yield* promptService.confirmOrThrow({
    message: nls.localize('org_delete_confirm_prompt', targetOrgs.length),
    confirmLabel: nls.localize('org_delete_confirm_label')
  });

  return { orgs: targetOrgs };
});
