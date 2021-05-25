/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { Observable } from 'rxjs/Observable';
import { CancellationTokenSource } from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../../channels/index';
import { nls } from '../../messages';
import { isDemoMode, isProdOrg } from '../../modes/demo-mode';
import {
  notificationService,
  ProgressNotification
} from '../../notifications/index';
import { SfdxProjectConfig } from '../../sfdxProject';
import { taskViewService } from '../../statuses/index';
import { getRootWorkspacePath, isSFDXContainerMode } from '../../util';

export const DEFAULT_ALIAS = 'vscodeOrg';
export const PRODUCTION_URL = 'https://login.salesforce.com';
export const SANDBOX_URL = 'https://test.salesforce.com';

export interface AuthParams {
  alias: string;
  loginUrl: string;
}

export class OrgTypeItem implements vscode.QuickPickItem {
  public label: string;
  public detail: string;
  constructor(localizeLabel: string, localizeDetail: string) {
    this.label = nls.localize(localizeLabel);
    this.detail = nls.localize(localizeDetail);
  }
}

export interface AccessTokenParams {
  accessToken: string;
}

export class AccessTokenParamsGatherer
  implements ParametersGatherer<AccessTokenParams> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<AccessTokenParams>
  > {
    const accessToken = await vscode.window.showInputBox({
      value: '',
      placeHolder: 'Enter access token', // TODO: nls
      password: true,
      validateInput: text => {
        return text && text.length > 0 ? null : 'Enter a valid access token'; // TODO: nls
      }
    });
    if (accessToken === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: { accessToken }
    };
  }
}

export class AuthParamsGatherer implements ParametersGatherer<AuthParams> {
  public readonly orgTypes = {
    project: new OrgTypeItem('auth_project_label', 'auth_project_detail'),
    production: new OrgTypeItem('auth_prod_label', 'auth_prod_detail'),
    sandbox: new OrgTypeItem('auth_sandbox_label', 'auth_sandbox_detail'),
    custom: new OrgTypeItem('auth_custom_label', 'auth_custom_detail')
  };

  public static readonly validateUrl = (url: string) => {
    const expr = /https?:\/\/(.*)/;
    if (expr.test(url)) {
      return null;
    }
    return nls.localize('auth_invalid_url');
  };

  public async getProjectLoginUrl(): Promise<string | undefined> {
    return (await SfdxProjectConfig.getValue('sfdcLoginUrl')) as string;
  }

  public async getQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const projectUrl = await this.getProjectLoginUrl();
    const items: vscode.QuickPickItem[] = [
      this.orgTypes.production,
      this.orgTypes.sandbox,
      this.orgTypes.custom
    ];
    if (projectUrl) {
      const { project } = this.orgTypes;
      project.detail = `${nls.localize('auth_project_detail')} (${projectUrl})`;
      items.unshift(project);
    }
    return items;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<AuthParams>
  > {
    const quickPickItems = await this.getQuickPickItems();
    const selection = await vscode.window.showQuickPick(quickPickItems);
    if (!selection) {
      return { type: 'CANCEL' };
    }

    const orgType = selection.label;
    let loginUrl: string | undefined;
    if (orgType === this.orgTypes.custom.label) {
      const customUrlInputOptions = {
        prompt: nls.localize('parameter_gatherer_enter_custom_url'),
        placeHolder: PRODUCTION_URL,
        validateInput: AuthParamsGatherer.validateUrl
      };
      loginUrl = await vscode.window.showInputBox(customUrlInputOptions);
      if (loginUrl === undefined) {
        return { type: 'CANCEL' };
      }
    } else if (orgType === this.orgTypes.project.label) {
      loginUrl = await this.getProjectLoginUrl();
    } else {
      loginUrl = orgType === 'Sandbox' ? SANDBOX_URL : PRODUCTION_URL;
    }

    const aliasInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS
    } as vscode.InputBoxOptions;
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will default the alias to 'vscodeOrg'
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        alias: alias || DEFAULT_ALIAS,
        loginUrl: loginUrl || PRODUCTION_URL
      }
    };
  }
}
