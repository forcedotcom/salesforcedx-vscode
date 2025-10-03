/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

import { nls } from '../../messages';
import { MessageKey } from '../../messages/i18n';
import { SalesforceProjectConfig } from '../../salesforceProject';

export const DEFAULT_ALIAS = 'vscodeOrg';
const PRODUCTION_URL = 'https://login.salesforce.com';
const SANDBOX_URL = 'https://test.salesforce.com';
const INSTANCE_URL_PLACEHOLDER = 'https://na35.salesforce.com';

export type AuthParams = {
  alias: string;
  loginUrl: string;
};

export type AccessTokenParams = {
  alias: string;
  instanceUrl: string;
  accessToken: string;
};

const inputInstanceUrl = async (): Promise<string | undefined> =>
  vscode.window.showInputBox({
    prompt: nls.localize('parameter_gatherer_enter_instance_url'),
    placeHolder: INSTANCE_URL_PLACEHOLDER,
    validateInput: validateUrl,
    ignoreFocusOut: true
  });

const inputAlias = async (): Promise<string | undefined> =>
  vscode.window.showInputBox({
    prompt: nls.localize('parameter_gatherer_enter_alias_name'),
    placeHolder: DEFAULT_ALIAS,
    ignoreFocusOut: true
  });

const inputAccessToken = async (): Promise<string | undefined> =>
  vscode.window.showInputBox({
    value: '',
    prompt: nls.localize('parameter_gatherer_enter_session_id'),
    placeHolder: nls.localize('parameter_gatherer_enter_session_id_placeholder'),
    password: true,
    ignoreFocusOut: true,
    validateInput: text =>
      text && text?.length > 0 ? null : nls.localize('parameter_gatherer_enter_session_id_diagnostic_message')
  });

class OrgTypeItem implements vscode.QuickPickItem {
  public label: string;
  public detail: string;
  constructor(localizeLabel: MessageKey, localizeDetail: MessageKey) {
    this.label = nls.localize(localizeLabel);
    this.detail = nls.localize(localizeDetail);
  }
}

const validateUrl = (url: string): string | null => {
  const expr = /https?:\/\/(.*)/;
  if (expr.test(url)) {
    return null;
  }
  return nls.localize('auth_invalid_url');
};
export class AuthParamsGatherer implements ParametersGatherer<AuthParams> {
  constructor(public instanceUrl: string | undefined) {}

  public readonly orgTypes = {
    project: new OrgTypeItem('auth_project_label', 'auth_project_detail'),
    production: new OrgTypeItem('auth_prod_label', 'auth_prod_detail'),
    sandbox: new OrgTypeItem('auth_sandbox_label', 'auth_sandbox_detail'),
    custom: new OrgTypeItem('auth_custom_label', 'auth_custom_detail')
  };

  public async getQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    const projectUrl = await getProjectLoginUrl();
    const items: vscode.QuickPickItem[] = [this.orgTypes.production, this.orgTypes.sandbox, this.orgTypes.custom];
    if (projectUrl) {
      const { project } = this.orgTypes;
      project.detail = `${nls.localize('auth_project_detail')} (${projectUrl})`;
      items.unshift(project);
    }
    return items;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<AuthParams>> {
    // allow passing in the instance url programmatically instead of via quick pick
    if (!this.instanceUrl) {
      const quickPickItems = await this.getQuickPickItems();
      const selection = await vscode.window.showQuickPick(quickPickItems);
      if (!selection) {
        return { type: 'CANCEL' };
      }

      const orgType = selection.label;
      if (orgType === this.orgTypes.custom.label) {
        const customUrlInputOptions = {
          prompt: nls.localize('parameter_gatherer_enter_custom_url'),
          placeHolder: PRODUCTION_URL,
          validateInput: validateUrl
        };
        this.instanceUrl = await vscode.window.showInputBox(customUrlInputOptions);
        if (this.instanceUrl === undefined) {
          return { type: 'CANCEL' };
        }
      } else if (orgType === this.orgTypes.project.label) {
        this.instanceUrl = await getProjectLoginUrl();
      } else {
        this.instanceUrl = orgType === 'Sandbox' ? SANDBOX_URL : PRODUCTION_URL;
      }
    }

    const aliasInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS
    };
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will default the alias to 'vscodeOrg'
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        alias: alias ?? DEFAULT_ALIAS,
        loginUrl: this.instanceUrl ?? PRODUCTION_URL
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
        alias: alias ?? DEFAULT_ALIAS,
        instanceUrl
      }
    };
  }
}

export class ScratchOrgLogoutParamsGatherer implements ParametersGatherer<string> {
  constructor(
    public readonly username: string,
    public readonly alias?: string
  ) {}

  public async gather(): Promise<CancelResponse | ContinueResponse<string>> {
    const prompt = nls.localize('org_logout_scratch_prompt', this.alias ?? this.username);
    const logoutResponse = nls.localize('org_logout_scratch_logout');

    const confirm = await vscode.window.showInformationMessage(prompt, { modal: true }, logoutResponse);
    return confirm === logoutResponse ? { type: 'CONTINUE', data: this.username } : { type: 'CANCEL' };
  }
}

const getProjectLoginUrl = async (): Promise<string | undefined> => SalesforceProjectConfig.getValue('sfdcLoginUrl');
