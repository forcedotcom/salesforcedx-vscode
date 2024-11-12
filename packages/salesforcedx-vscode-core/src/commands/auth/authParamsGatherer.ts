/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

import { nls } from '../../messages';
import { SalesforceProjectConfig } from '../../salesforceProject';

export const DEFAULT_ALIAS = 'vscodeOrg';
export const PRODUCTION_URL = 'https://login.salesforce.com';
export const SANDBOX_URL = 'https://test.salesforce.com';
export const INSTANCE_URL_PLACEHOLDER = 'https://na35.salesforce.com';

export type AuthParams = {
  alias: string;
  loginUrl: string;
};

export type AccessTokenParams = {
  alias: string;
  instanceUrl: string;
  accessToken: string;
};

const inputInstanceUrl = async (): Promise<string | undefined> => {
  const instanceUrlInputOptions = {
    prompt: nls.localize('parameter_gatherer_enter_instance_url'),
    placeHolder: INSTANCE_URL_PLACEHOLDER,
    validateInput: AuthParamsGatherer.validateUrl,
    ignoreFocusOut: true
  };
  const instanceUrl = await vscode.window.showInputBox(instanceUrlInputOptions);
  return instanceUrl;
};

const inputAlias = async (): Promise<string | undefined> => {
  const aliasInputOptions = {
    prompt: nls.localize('parameter_gatherer_enter_alias_name'),
    placeHolder: DEFAULT_ALIAS,
    ignoreFocusOut: true
  } as vscode.InputBoxOptions;
  const alias = await vscode.window.showInputBox(aliasInputOptions);
  return alias;
};

const inputAccessToken = async (): Promise<string | undefined> => {
  const accessToken = await vscode.window.showInputBox({
    value: '',
    prompt: nls.localize('parameter_gatherer_enter_session_id'),
    placeHolder: nls.localize('parameter_gatherer_enter_session_id_placeholder'),
    password: true,
    ignoreFocusOut: true,
    validateInput: text => {
      return text && text.length > 0 ? null : nls.localize('parameter_gatherer_enter_session_id_diagnostic_message');
    }
  });
  return accessToken;
};

export class OrgTypeItem implements vscode.QuickPickItem {
  public label: string;
  public detail: string;
  constructor(localizeLabel: string, localizeDetail: string) {
    this.label = nls.localize(localizeLabel);
    this.detail = nls.localize(localizeDetail);
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
    return await SalesforceProjectConfig.getValue('sfdcLoginUrl');
  }

  public async getQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const projectUrl = await this.getProjectLoginUrl();
    const items: vscode.QuickPickItem[] = [this.orgTypes.production, this.orgTypes.sandbox, this.orgTypes.custom];
    if (projectUrl) {
      const { project } = this.orgTypes;
      project.detail = `${nls.localize('auth_project_detail')} (${projectUrl})`;
      items.unshift(project);
    }
    return items;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<AuthParams>> {
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

export class AccessTokenParamsGatherer implements ParametersGatherer<AccessTokenParams> {
  public async gather(): Promise<CancelResponse | ContinueResponse<AccessTokenParams>> {
    const instanceUrl = await inputInstanceUrl();
    if (instanceUrl === undefined) {
      return { type: 'CANCEL' };
    }

    const alias = await inputAlias();
    // Hitting enter with no alias will default the alias to 'vscodeOrg'
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }

    const accessToken = await inputAccessToken();
    if (accessToken === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        accessToken,
        alias: alias || DEFAULT_ALIAS,
        instanceUrl
      }
    };
  }
}

export class ScratchOrgLogoutParamsGatherer implements ParametersGatherer<string> {
  public constructor(
    public readonly username: string,
    public readonly alias?: string
  ) {}

  public async gather(): Promise<CancelResponse | ContinueResponse<string>> {
    const prompt = nls.localize('org_logout_scratch_prompt', this.alias || this.username);
    const logoutResponse = nls.localize('org_logout_scratch_logout');

    const confirm = await vscode.window.showInformationMessage(prompt, { modal: true }, ...[logoutResponse]);
    if (confirm !== logoutResponse) {
      return { type: 'CANCEL' };
    }

    return {
      type: 'CONTINUE',
      data: this.username
    };
  }
}
