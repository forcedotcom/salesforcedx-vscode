/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, AuthInfo, OrgAuthorization } from '@salesforce/core';
import {
  CancelResponse,
  ConfigUtil,
  ContinueResponse,
  OrgUserInfo
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { OrgAuthInfo } from '../util';

export class OrgList implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      49
    );
    this.statusBarItem.command = 'sfdx.force.set.default.org';
    this.statusBarItem.tooltip = nls.localize('status_bar_org_picker_tooltip');
    this.statusBarItem.show();

    WorkspaceContext.getInstance().onOrgChange((orgInfo: OrgUserInfo) =>
      this.displayDefaultUsername(orgInfo.alias || orgInfo.username)
    );
    const { username, alias } = WorkspaceContext.getInstance();
    this.displayDefaultUsername(alias || username);
  }

  private displayDefaultUsername(defaultUsernameOrAlias?: string) {
    if (defaultUsernameOrAlias) {
      this.statusBarItem.text = `$(plug) ${defaultUsernameOrAlias}`;
    } else {
      this.statusBarItem.text = nls.localize('missing_default_org');
    }
  }

  public async getOrgAuthorizations(): Promise<OrgAuthorization[]> {
    const orgAuthorizations = await AuthInfo.listAllAuthorizations();
    return orgAuthorizations;
  }

  public async getAuthFieldsFor(username: string): Promise<AuthFields> {
    const authInfo: AuthInfo = await AuthInfo.create({
      username
    });
    return authInfo.getFields();
  }

  public async filterAuthInfo(
    orgAuthorizations: OrgAuthorization[]
  ): Promise<string[]> {
    const defaultDevHubUsername = await OrgAuthInfo.getDevHubUsername();

    const authList = [];
    const today = new Date();
    for (const orgAuth of orgAuthorizations) {
      // When this is called right after logging out of an org, there can
      // still be a cached Org Auth in the list with a "No auth information found"
      // error. This warning prevents that error from stopping the process, and
      // should help in debugging if there are any other Org Auths with errors.
      if (orgAuth.error) {
        console.warn(
          `Org Auth for username: ${orgAuth.username} has an error: ${orgAuth.error}`
        );
        continue;
      }
      const authFields: AuthFields = await this.getAuthFieldsFor(
        orgAuth.username
      );
      if (authFields && 'scratchAdminUsername' in authFields) {
        // non-Admin scratch org users
        continue;
      }
      if (
        authFields &&
        'devHubUsername' in authFields &&
        authFields.devHubUsername !== defaultDevHubUsername
      ) {
        // scratch orgs parented by other (non-default) devHub orgs
        continue;
      }
      const isExpired =
        authFields && authFields.expirationDate
          ? today >= new Date(authFields.expirationDate)
          : false;

      const aliases = await ConfigUtil.getAllAliasesFor(orgAuth.username);
      let authListItem =
        aliases && aliases.length > 0
          ? `${aliases} - ${orgAuth.username}`
          : orgAuth.username;

      if (isExpired) {
        authListItem += ` - ${nls.localize(
          'org_expired'
        )} ${String.fromCodePoint(0x274c)}`; // cross-mark
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
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text'),
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_dev_hub_text'),
      '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text'),
      '$(plus) ' + nls.localize('force_auth_access_token_authorize_org_text'),
      '$(plus) ' + nls.localize('force_org_list_clean_text')
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
      case '$(plus) ' +
        nls.localize('force_auth_web_login_authorize_org_text'): {
        vscode.commands.executeCommand('sfdx.force.auth.web.login');
        return { type: 'CONTINUE', data: {} };
      }
      case '$(plus) ' +
        nls.localize('force_auth_web_login_authorize_dev_hub_text'): {
        vscode.commands.executeCommand('sfdx.force.auth.dev.hub');
        return { type: 'CONTINUE', data: {} };
      }
      case '$(plus) ' +
        nls.localize('force_org_create_default_scratch_org_text'): {
        vscode.commands.executeCommand('sfdx.force.org.create');
        return { type: 'CONTINUE', data: {} };
      }
      case '$(plus) ' +
        nls.localize('force_auth_access_token_authorize_org_text'): {
        vscode.commands.executeCommand('sfdx.force.auth.accessToken');
        return { type: 'CONTINUE', data: {} };
      }
      case '$(plus) ' + nls.localize('force_org_list_clean_text'): {
        vscode.commands.executeCommand('sfdx.force.org.list.clean');
        return { type: 'CONTINUE', data: {} };
      }
      default: {
        const usernameOrAlias = selection.split(' - ', 1);
        vscode.commands.executeCommand(
          'sfdx.force.config.set',
          usernameOrAlias
        );
        return { type: 'CONTINUE', data: {} };
      }
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
