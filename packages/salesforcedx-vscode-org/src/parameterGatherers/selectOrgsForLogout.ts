/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, OrgAuthorization } from '@salesforce/core';
import type { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../orgPicker/orgList';
import { getDefaultOrgConfiguration, readAliasesByUsernameFromDisk } from '../util/orgUtil';

/** Multi-select QuickPick for logout with a confirmation modal before proceeding. */
export class SelectOrgsForLogout implements ParametersGatherer<{ usernames: string[] }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ usernames: string[] }>> {
    const [defaultConfig, authorizations, aliasesByUsername] = await Promise.all([
      getDefaultOrgConfiguration(),
      AuthInfo.listAllAuthorizations(),
      readAliasesByUsernameFromDisk()
    ]);

    const freshAuthorizations: OrgAuthorization[] = authorizations.map(org =>
      org.aliases?.length ? org : { ...org, aliases: aliasesByUsername.get(org.username) ?? [] }
    );

    const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig);

    const selections = await vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_logout_select_orgs_placeholder'),
      canPickMany: true,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selections || selections.length === 0) {
      return { type: 'CANCEL' };
    }

    const targetAuthorizations = freshAuthorizations.filter(org =>
      selections.some(s => isOrgItem(s) && s.orgUsername === org.username)
    );

    if (targetAuthorizations.length === 0) {
      return { type: 'CANCEL' };
    }

    const hasScratchOrSandbox = targetAuthorizations.some(org => org.isScratchOrg === true || org.isSandbox === true);
    const count = String(targetAuthorizations.length);
    const prompt = hasScratchOrSandbox
      ? nls.localize('org_logout_confirm_scratch_prompt', count)
      : nls.localize('org_logout_confirm_prompt', count);

    const confirmLabel = nls.localize('org_logout_scratch_logout');
    const confirm = await vscode.window.showInformationMessage(prompt, { modal: true }, confirmLabel);
    if (confirm !== confirmLabel) {
      return { type: 'CANCEL' };
    }

    return { type: 'CONTINUE', data: { usernames: targetAuthorizations.map(org => org.username) } };
  }
}
