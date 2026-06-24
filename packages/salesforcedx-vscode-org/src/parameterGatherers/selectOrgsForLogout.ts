/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { getOrgRuntime } from '../extensionProvider';
import { nls } from '../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../orgPicker/orgList';
import { getFreshAuthorizations } from '../util/orgUtil';

/** Multi-select QuickPick for logout with a confirmation modal before proceeding. */
export class SelectOrgsForLogout implements ParametersGatherer<{ usernames: string[] }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ usernames: string[] }>> {
    return getOrgRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const { defaultConfig, freshAuthorizations } = yield* getFreshAuthorizations();

        const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig);

        const selections = yield* Effect.promise(() =>
          vscode.window.showQuickPick(items, {
            placeHolder: nls.localize('org_logout_select_orgs_placeholder'),
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

        const targetAuthorizations = freshAuthorizations.filter(org =>
          selections.some(s => isOrgItem(s) && s.orgUsername === org.username)
        );

        if (targetAuthorizations.length === 0) {
          return yield* new api.services.UserCancellationError({});
        }

        const hasScratchOrSandbox = targetAuthorizations.some(
          org => org.isScratchOrg === true || org.isSandbox === true
        );
        const count = String(targetAuthorizations.length);
        const prompt = hasScratchOrSandbox
          ? nls.localize('org_logout_confirm_scratch_prompt', count)
          : nls.localize('org_logout_confirm_prompt', count);

        const confirmLabel = nls.localize('org_logout_scratch_logout');
        const confirm = yield* Effect.promise(() =>
          vscode.window.showInformationMessage(prompt, { modal: true }, confirmLabel)
        );
        if (confirm !== confirmLabel) {
          return yield* new api.services.UserCancellationError({});
        }

        return { usernames: targetAuthorizations.map(org => org.username) };
      }).pipe(
        Effect.map((data): ContinueResponse<{ usernames: string[] }> => ({ type: 'CONTINUE', data })),
        Effect.catchTag(
          'UserCancellationError',
          (): Effect.Effect<CancelResponse> => Effect.succeed({ type: 'CANCEL' })
        )
      )
    );
  }
}
