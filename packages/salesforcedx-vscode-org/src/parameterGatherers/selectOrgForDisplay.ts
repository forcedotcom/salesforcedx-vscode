/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core';
import type { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../orgPicker/orgList';
import { getDefaultOrgConfiguration, readAliasesByUsernameFromDisk } from '../util/orgUtil';

/** QuickPick that shows all authenticated orgs for the user to pick one to display info for. */
export class SelectOrgForDisplay implements ParametersGatherer<{ username: string }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ username: string }>> {
    const [defaultConfig, authorizations, aliasesByUsername] = await Promise.all([
      getDefaultOrgConfiguration(),
      AuthInfo.listAllAuthorizations(),
      readAliasesByUsernameFromDisk()
    ]);

    const freshAuthorizations = authorizations.map(org =>
      org.aliases?.length ? org : { ...org, aliases: aliasesByUsername.get(org.username) ?? [] }
    );

    const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig);
    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_select_text'),
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selection || !isOrgItem(selection) || !selection.orgUsername) {
      return { type: 'CANCEL' };
    }

    return { type: 'CONTINUE', data: { username: selection.orgUsername } };
  }
}
