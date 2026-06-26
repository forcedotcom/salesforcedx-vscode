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
import { nls } from '../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../orgPicker/orgList';
import { getFreshAuthorizations } from '../util/orgUtil';
import { runGatherer } from './runGatherer';

const gather = Effect.fn('SelectOrgsForLogout.gather')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const { defaultConfig, freshAuthorizations } = yield* getFreshAuthorizations();

  const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig);

  const selections = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_logout_select_orgs_placeholder'),
      canPickMany: true,
      matchOnDescription: true,
      matchOnDetail: true
    })
  ).pipe(Effect.flatMap(promptService.considerEmptySelectionAsCancellation));

  const targetAuthorizations = freshAuthorizations.filter(org =>
    selections.some(s => isOrgItem(s) && s.orgUsername === org.username)
  );

  if (targetAuthorizations.length === 0) {
    return yield* new api.services.UserCancellationError({});
  }

  const hasScratchOrSandbox = targetAuthorizations.some(org => org.isScratchOrg === true || org.isSandbox === true);
  const count = String(targetAuthorizations.length);
  const prompt = hasScratchOrSandbox
    ? nls.localize('org_logout_confirm_scratch_prompt', count)
    : nls.localize('org_logout_confirm_prompt', count);

  yield* promptService.confirmOrThrow({ message: prompt, confirmLabel: nls.localize('org_logout_scratch_logout') });

  return { usernames: targetAuthorizations.map(org => org.username) };
});

/** Multi-select QuickPick for logout with a confirmation modal before proceeding. */
export class SelectOrgsForLogout implements ParametersGatherer<{ usernames: string[] }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ usernames: string[] }>> {
    return runGatherer(gather());
  }
}
