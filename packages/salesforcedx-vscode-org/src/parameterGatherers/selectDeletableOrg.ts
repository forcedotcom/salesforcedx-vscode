/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgAuthorization } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { getOrgRuntime } from '../extensionProvider';
import { nls } from '../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../orgPicker/orgList';
import { getFreshAuthorizations } from '../util/orgUtil';

export type OrgToDelete = { username: string; orgType: 'scratch' | 'sandbox' };

const isDeletable = (org: OrgAuthorization): boolean => org.isScratchOrg === true || org.isSandbox === true;

/** Multi-select QuickPick filtered to scratch orgs and sandboxes with a delete confirmation. */
export class SelectDeletableOrg implements ParametersGatherer<{ orgs: OrgToDelete[] }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ orgs: OrgToDelete[] }>> {
    return getOrgRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const { defaultConfig, freshAuthorizations } = yield* getFreshAuthorizations();

        const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig, isDeletable);
        const selections = yield* Effect.promise(() =>
          vscode.window.showQuickPick(items, {
            placeHolder: nls.localize('org_delete_select_orgs_placeholder'),
            canPickMany: true,
            matchOnDescription: true,
            matchOnDetail: true
          })
        ).pipe(
          // Multi-pick: considerUndefinedAsCancellation does not catch the empty-array (pick-nothing) cancel.
          Effect.flatMap(selected =>
            selected === undefined || selected.length === 0
              ? new api.services.UserCancellationError({})
              : Effect.succeed(selected)
          )
        );

        const targetOrgs: OrgToDelete[] = selections.filter(isOrgItem).flatMap(s => {
          if (!s.orgUsername) return [];
          const auth = freshAuthorizations.find(o => o.username === s.orgUsername);
          const orgType = auth?.isScratchOrg === true ? 'scratch' : 'sandbox';
          return [{ username: s.orgUsername, orgType }];
        });

        if (targetOrgs.length === 0) {
          return yield* new api.services.UserCancellationError({});
        }

        const confirmLabel = nls.localize('org_delete_confirm_label');
        const confirm = yield* Effect.promise(() =>
          vscode.window.showInformationMessage(
            nls.localize('org_delete_confirm_prompt', targetOrgs.length),
            { modal: true },
            confirmLabel
          )
        );

        if (confirm !== confirmLabel) {
          return yield* new api.services.UserCancellationError({});
        }

        return { orgs: targetOrgs };
      }).pipe(
        Effect.map((data): ContinueResponse<{ orgs: OrgToDelete[] }> => ({ type: 'CONTINUE', data })),
        Effect.catchTag(
          'UserCancellationError',
          (): Effect.Effect<CancelResponse> => Effect.succeed({ type: 'CANCEL' })
        )
      )
    );
  }
}
