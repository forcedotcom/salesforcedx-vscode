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

export type DeletableOrgParams = { username: string; orgType: 'scratch' | 'sandbox' };

const isDeletable = (org: OrgAuthorization): boolean => org.isScratchOrg === true || org.isSandbox === true;

/** QuickPick filtered to scratch orgs and sandboxes — the only org types that can be destroyed. */
export class SelectDeletableOrg implements ParametersGatherer<DeletableOrgParams> {
  public async gather(): Promise<CancelResponse | ContinueResponse<DeletableOrgParams>> {
    const [defaultConfig, authorizations, aliasesByUsername] = await Promise.all([
      getDefaultOrgConfiguration(),
      AuthInfo.listAllAuthorizations(),
      readAliasesByUsernameFromDisk()
    ]);

    const freshAuthorizations = authorizations.map(org =>
      org.aliases?.length ? org : { ...org, aliases: aliasesByUsername.get(org.username) ?? [] }
    );

    const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig, isDeletable);
    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_select_text'),
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selection || !isOrgItem(selection) || !selection.orgUsername) {
      return { type: 'CANCEL' };
    }

    const selected = freshAuthorizations.find(o => o.username === selection.orgUsername);
    const orgType = selected?.isScratchOrg ? 'scratch' : 'sandbox';

    return { type: 'CONTINUE', data: { username: selection.orgUsername, orgType } };
  }
}
