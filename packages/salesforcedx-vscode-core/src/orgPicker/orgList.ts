/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo, AuthInfoConfig } from '@salesforce/core';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { readFileSync } from 'fs';
import * as path from 'path';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { setupWorkspaceOrgType } from '../context/index';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

export interface FileInfo {
  scratchAdminUsername?: string;
  isDevHub?: boolean;
  username: string;
  devHubUsername?: string;
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
  }

  public displayDefaultUsername(defaultUsernameorAlias?: string) {
    if (!isNullOrUndefined(defaultUsernameorAlias)) {
      this.statusBarItem.text = `$(plug) ${defaultUsernameorAlias}`;
    } else {
      this.statusBarItem.text = nls.localize('missing_default_org');
    }
  }

  public async getAuthInfoObjects() {
    const authFilesArray = await AuthInfo.listAllAuthFiles().catch(err => null);

    if (authFilesArray === null || authFilesArray.length === 0) {
      return null;
    }
    const authInfoObjects: FileInfo[] = [];
    for (const username of authFilesArray) {
      try {
        const filePath = path.join(
          await AuthInfoConfig.resolveRootFolder(true),
          '.sfdx',
          username
        );
        const fileData = readFileSync(filePath, 'utf8');
        authInfoObjects.push(JSON.parse(fileData));
      } catch (e) {
        console.log(e);
      }
    }
    return authInfoObjects;
  }

  public async filterAuthInfo(authInfoObjects: FileInfo[]) {
    authInfoObjects = authInfoObjects.filter(fileData =>
      isNullOrUndefined(fileData.scratchAdminUsername)
    );

    const defaultDevHubUsernameorAlias = await this.getDefaultDevHubUsernameorAlias();
    if (defaultDevHubUsernameorAlias) {
      const defaultDevHubUsername = await OrgAuthInfo.getUsername(
        defaultDevHubUsernameorAlias
      );

      authInfoObjects = authInfoObjects.filter(
        fileData =>
          isNullOrUndefined(fileData.devHubUsername) ||
          (!isNullOrUndefined(fileData.devHubUsername) &&
            fileData.devHubUsername === defaultDevHubUsername)
      );
    }

    const authUsernames = authInfoObjects.map(file => file.username);
    const aliases = await Aliases.create(Aliases.getDefaultOptions());
    const authList = [];
    for (const username of authUsernames) {
      const alias = await aliases.getKeysByValue(username);
      if (alias.length > 0) {
        authList.push(alias + ' - ' + username);
      } else {
        authList.push(username);
      }
    }
    return authList;
  }

  public async updateOrgList() {
    const authInfoObjects = await this.getAuthInfoObjects();
    if (isNullOrUndefined(authInfoObjects)) {
      return null;
    }
    const authUsernameList = await this.filterAuthInfo(authInfoObjects);
    return authUsernameList;
  }

  public async setDefaultOrg(): Promise<CancelResponse | ContinueResponse<{}>> {
    let quickPickList = [
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text'),
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_dev_hub_text'),
      '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text')
    ];

    const authInfoList = await this.updateOrgList();
    if (!isNullOrUndefined(authInfoList)) {
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
        return {
          type: 'CONTINUE',
          data: {}
        };
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

  public async onSfdxConfigEvent() {
    let defaultUsernameorAlias: string | undefined;
    if (hasRootWorkspace()) {
      defaultUsernameorAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(
        false
      );
    }
    telemetryService.sendEventData(
      'Sfdx-config file updated with default username',
      undefined,
      { timestamp: new Date().getTime() }
    );
    await setupWorkspaceOrgType(defaultUsernameorAlias);
    this.displayDefaultUsername(defaultUsernameorAlias);
  }

  public registerDefaultUsernameWatcher(context: vscode.ExtensionContext) {
    if (hasRootWorkspace()) {
      const sfdxConfigWatcher = vscode.workspace.createFileSystemWatcher(
        path.join(getRootWorkspacePath(), '.sfdx', 'sfdx-config.json')
      );
      sfdxConfigWatcher.onDidChange(uri => this.onSfdxConfigEvent());
      sfdxConfigWatcher.onDidCreate(uri => this.onSfdxConfigEvent());
      sfdxConfigWatcher.onDidDelete(uri => this.onSfdxConfigEvent());
      context.subscriptions.push(sfdxConfigWatcher);
    }
  }
}
