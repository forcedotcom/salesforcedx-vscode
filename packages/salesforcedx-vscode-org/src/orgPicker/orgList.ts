/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, AuthInfo, OrgAuthorization } from '@salesforce/core';
import { CancelResponse, ConfigUtil, ContinueResponse, OrgUserInfo } from '@salesforce/salesforcedx-utils-vscode';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { OrgAuthInfo } from '../util';
import { getAuthFieldsFor } from '../util/orgUtil';

const getCoreApi = (): SalesforceVSCodeCoreApi | undefined => {
  const coreExtension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core');
  return coreExtension?.exports;
};

export class OrgList implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
    this.statusBarItem.command = 'sf.set.default.org';
    this.statusBarItem.tooltip = nls.localize('status_bar_org_picker_tooltip');
    this.statusBarItem.show();

    const WorkspaceContext = getCoreApi()?.WorkspaceContext;
    if (WorkspaceContext) {
      WorkspaceContext.getInstance().onOrgChange((orgInfo: OrgUserInfo) =>
        this.displayTargetOrg(orgInfo.alias ?? orgInfo.username)
      );
      const { username, alias } = WorkspaceContext.getInstance();
      void this.displayTargetOrg(alias ?? username);
    }
  }

  private async displayTargetOrg(targetOrgOrAlias?: string): Promise<void> {
    if (targetOrgOrAlias) {
      try {
        const isExpired = await this.isOrgExpired(targetOrgOrAlias);
        if (isExpired) {
          this.statusBarItem.text = `$(warning) ${targetOrgOrAlias}`;
        } else {
          this.statusBarItem.text = `$(plug) ${targetOrgOrAlias}`;
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'NamedOrgNotFoundError') {
          this.statusBarItem.text = `$(error) ${nls.localize('invalid_default_org')}`;
        }
        console.error('Error checking org expiration: ', error);
      }
    } else {
      this.statusBarItem.text = nls.localize('missing_default_org');
    }
  }

  public async getOrgAuthorizations(): Promise<OrgAuthorization[]> {
    const orgAuthorizations = await AuthInfo.listAllAuthorizations();
    return orgAuthorizations;
  }

  public async isOrgExpired(targetOrgOrAlias: string): Promise<boolean> {
    const username = await ConfigUtil.getUsernameFor(targetOrgOrAlias);
    const authFields = await getAuthFieldsFor(username);
    let expirationDate;
    if (authFields.expirationDate) {
      expirationDate = new Date(authFields.expirationDate);
    }
    return expirationDate ? expirationDate < new Date() : false;
  }

  public async filterAuthInfo(orgAuthorizations: OrgAuthorization[], showExpired: boolean = false): Promise<string[]> {
    const targetDevHub = await OrgAuthInfo.getDevHubUsername();

    const authList = [];
    for (const orgAuth of orgAuthorizations) {
      // When this is called right after logging out of an org, there can
      // still be a cached Org Auth in the list with a "No auth information found"
      // error. This warning prevents that error from stopping the process, and
      // should help in debugging if there are any other Org Auths with errors.
      if (orgAuth.error) {
        console.warn(`Org Auth for username: ${orgAuth.username} has an error: ${orgAuth.error}`);
        continue;
      }
      const authFields: AuthFields = await getAuthFieldsFor(orgAuth.username);
      if (authFields && 'scratchAdminUsername' in authFields) {
        // non-Admin scratch org users
        continue;
      }
      if (authFields && 'devHubUsername' in authFields && authFields.devHubUsername !== targetDevHub) {
        // scratch orgs parented by other (non-default) devHub orgs
        continue;
      }
      const isExpired = authFields?.expirationDate ? new Date(authFields.expirationDate) < new Date() : false;

      // Skip expired orgs unless explicitly requested to show them
      if (isExpired && !showExpired) {
        continue;
      }

      const aliases = await ConfigUtil.getAllAliasesFor(orgAuth.username);
      let authListItem = aliases?.length > 0 ? `${aliases.join(',')} - ${orgAuth.username}` : orgAuth.username;

      if (isExpired) {
        authListItem += ` - ${nls.localize('org_expired')} ${String.fromCodePoint(0x274c)}`; // cross-mark
      }

      authList.push(authListItem);
    }
    return authList;
  }

  public async updateOrgList(): Promise<string[]> {
    const orgAuthorizations = await this.getOrgAuthorizations();
    if (orgAuthorizations && orgAuthorizations.length === 0) {
      return [];
    }
    const authUsernameList = await this.filterAuthInfo(orgAuthorizations);
    return authUsernameList;
  }

  public async setDefaultOrg(): Promise<CancelResponse | ContinueResponse<{}>> {
    let quickPickList = [
      `$(plus) ${nls.localize('org_login_web_authorize_org_text')}`,
      `$(plus) ${nls.localize('org_login_web_authorize_dev_hub_text')}`,
      `$(plus) ${nls.localize('org_create_default_scratch_org_text')}`,
      `$(plus) ${nls.localize('org_login_access_token_text')}`,
      `$(plus) ${nls.localize('org_list_clean_text')}`
    ];

    const authInfoList = await this.updateOrgList();
    quickPickList = quickPickList.concat(authInfoList);

    const selection = await vscode.window.showQuickPick(quickPickList, {
      placeHolder: nls.localize('org_select_text')
    });

    if (!selection) {
      return { type: 'CANCEL' };
    }
    switch (selection) {
      case `$(plus) ${nls.localize('org_login_web_authorize_org_text')}`: {
        vscode.commands.executeCommand('sf.org.login.web');
        return { type: 'CONTINUE', data: {} };
      }
      case `$(plus) ${nls.localize('org_login_web_authorize_dev_hub_text')}`: {
        vscode.commands.executeCommand('sf.org.login.web.dev.hub');
        return { type: 'CONTINUE', data: {} };
      }
      case `$(plus) ${nls.localize('org_create_default_scratch_org_text')}`: {
        vscode.commands.executeCommand('sf.org.create');
        return { type: 'CONTINUE', data: {} };
      }
      case `$(plus) ${nls.localize('org_login_access_token_text')}`: {
        vscode.commands.executeCommand('sf.org.login.access.token');
        return { type: 'CONTINUE', data: {} };
      }
      case `$(plus) ${nls.localize('org_list_clean_text')}`: {
        vscode.commands.executeCommand('sf.org.list.clean');
        return { type: 'CONTINUE', data: {} };
      }
      default: {
        // Extract the username or alias from the selection
        // Format is: "alias1,alias2,alias3 - username" or "alias1,alias2,alias3 - username - Expired ❌"
        // or just "username" or "username - Expired ❌"
        const cleanSelection = selection.endsWith(' - Expired ❌') ? selection.replace(' - Expired ❌', '') : selection;
        const lastDashIndex = cleanSelection.lastIndexOf(' - ');
        const usernameOrAlias = lastDashIndex !== -1 ? cleanSelection.substring(0, lastDashIndex) : cleanSelection;

        vscode.commands.executeCommand('sf.config.set', usernameOrAlias);
        return { type: 'CONTINUE', data: {} };
      }
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
