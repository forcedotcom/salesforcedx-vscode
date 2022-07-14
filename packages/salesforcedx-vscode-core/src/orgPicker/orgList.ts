/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, ConfigFile, StateAggregator } from '@salesforce/core';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OrgInfo, workspaceContext } from '../context';
import { nls } from '../messages';
import { hasRootWorkspace, OrgAuthInfo } from '../util';

export interface FileInfo {
  scratchAdminUsername?: string;
  isDevHub?: boolean;
  username: string;
  devHubUsername?: string;
  expirationDate?: string;
}
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

    workspaceContext.onOrgChange((orgInfo: OrgInfo) =>
      this.displayDefaultUsername(orgInfo.alias || orgInfo.username)
    );
    const { username, alias } = workspaceContext;
    this.displayDefaultUsername(alias || username);
  }

  public displayDefaultUsername(defaultUsernameorAlias?: string) {
    if (defaultUsernameorAlias) {
      this.statusBarItem.text = `$(plug) ${defaultUsernameorAlias}`;
    } else {
      this.statusBarItem.text = nls.localize('missing_default_org');
    }
  }

  public async getAuthInfoObjects() {
    const authFilesArray = await AuthInfo.listAllAuthorizations().catch(
      err => null
    );
    return authFilesArray;
  }

  public async filterAuthInfo(authInfoObjects: FileInfo[]) {
    authInfoObjects = authInfoObjects.filter(
      fileData => !fileData.scratchAdminUsername
    );

    const defaultDevHubUsernameorAlias = await this.getDefaultDevHubUsernameorAlias();
    if (defaultDevHubUsernameorAlias) {
      const defaultDevHubUsername = await OrgAuthInfo.getUsername(
        defaultDevHubUsernameorAlias
      );

      authInfoObjects = authInfoObjects.filter(fileData => {
        const isNullOrUndefined = !fileData.devHubUsername;
        return (
          isNullOrUndefined ||
          (!isNullOrUndefined &&
            fileData.devHubUsername === defaultDevHubUsername)
        );
      });
    }

    // const aliases = await Aliases.create(Aliases.getDefaultOptions());
    const info = await StateAggregator.create();
    const authList = [];
    const today = new Date();
    for (const authInfo of authInfoObjects) {
      // TODO: Does this do the same thing as info.getKeysByValue(authInfo.username)
      const aliases = info.aliases.getAll(authInfo.username);
      const isExpired = authInfo.expirationDate
        ? today >= new Date(authInfo.expirationDate)
        : false;
      let authListItem =
        aliases?.length > 0
          ? `${aliases} - ${authInfo.username}`
          : authInfo.username;

      if (isExpired) {
        authListItem += ` - ${nls.localize(
          'org_expired'
        )} ${String.fromCodePoint(0x274c)}`; // cross-mark
      }

      authList.push(authListItem);
    }
    return authList;
  }

  public async updateOrgList() {
    const authInfoObjects = await this.getAuthInfoObjects();
    if (!authInfoObjects) {
      return null;
    }
    const authUsernameList = await this.filterAuthInfo(authInfoObjects);
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
    if (authInfoList) {
      quickPickList = quickPickList.concat(authInfoList);
    }

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

  public async getDefaultDevHubUsernameorAlias(): Promise<string | undefined> {
    if (hasRootWorkspace()) {
      return OrgAuthInfo.getDefaultDevHubUsernameOrAlias(false);
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
