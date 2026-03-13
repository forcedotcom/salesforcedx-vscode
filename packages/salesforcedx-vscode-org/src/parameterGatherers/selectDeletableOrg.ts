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

export type OrgToDelete = { username: string; orgType: 'scratch' | 'sandbox' };

const isDeletable = (org: OrgAuthorization): boolean => org.isScratchOrg === true || org.isSandbox === true;

/** Multi-select QuickPick filtered to scratch orgs and sandboxes with a delete confirmation. */
export class SelectDeletableOrg implements ParametersGatherer<{ orgs: OrgToDelete[] }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ orgs: OrgToDelete[] }>> {
    const [defaultConfig, authorizations, aliasesByUsername] = await Promise.all([
      getDefaultOrgConfiguration(),
      AuthInfo.listAllAuthorizations(),
      readAliasesByUsernameFromDisk()
    ]);

    const freshAuthorizations = authorizations.map(org =>
      org.aliases?.length ? org : { ...org, aliases: aliasesByUsername.get(org.username) ?? [] }
    );

    const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig, isDeletable);
    const selections = await vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_delete_select_orgs_placeholder'),
      canPickMany: true,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selections || selections.length === 0) {
      return { type: 'CANCEL' };
    }

    const targetOrgs: OrgToDelete[] = selections
      .filter(isOrgItem)
      .flatMap(s => {
        if (!s.orgUsername) return [];
        const auth = freshAuthorizations.find(o => o.username === s.orgUsername);
        const orgType = auth?.isScratchOrg === true ? 'scratch' : 'sandbox';
        return [{ username: s.orgUsername, orgType }];
      });

    if (targetOrgs.length === 0) {
      return { type: 'CANCEL' };
    }

    const count = String(targetOrgs.length);
    const confirmLabel = nls.localize('org_delete_confirm_label');
    const confirm = await vscode.window.showInformationMessage(
      nls.localize('org_delete_confirm_prompt', count),
      { modal: true },
      confirmLabel
    );

    if (confirm !== confirmLabel) {
      return { type: 'CANCEL' };
    }

    return { type: 'CONTINUE', data: { orgs: targetOrgs } };
  }
}
