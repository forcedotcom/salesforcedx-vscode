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

const validateUrl = (url: string): string | null => {
  const expr = /https?:\/\/(.*)/;
  if (expr.test(url)) {
    return null;
  }
  return nls.localize('auth_invalid_url');
};

const buildOrgTypes = (projectUrl: string | undefined): Record<string, vscode.QuickPickItem> =>
  Object.fromEntries(
    Object.entries({
      production: { label: 'auth_prod_label', detail: 'auth_prod_detail' },
      sandbox: { label: 'auth_sandbox_label', detail: 'auth_sandbox_detail' },
      custom: { label: 'auth_custom_label', detail: 'auth_custom_detail' }
    } as const)
      .map(([key, value]): [string, vscode.QuickPickItem] => [
        key,
        { label: nls.localize(value.label), detail: nls.localize(value.detail) }
      ])
      .concat(
        projectUrl
          ? [
              [
                'project',
                {
                  label: nls.localize('auth_project_label'),
                  detail: `${nls.localize('auth_project_detail')} (${projectUrl})`
                } as const
              ]
            ]
          : []
      )
  );

export class AuthParamsGatherer implements ParametersGatherer<AuthParams> {
  constructor(public instanceUrl: string | undefined) {}

  public async gather(): Promise<CancelResponse | ContinueResponse<AuthParams>> {
    const skipAlias = this.instanceUrl !== undefined;
    // allow passing in the instance url programmatically instead of via quick pick
    if (!this.instanceUrl) {
      const orgTypes = buildOrgTypes(await getProjectLoginUrl());
      const selection = await vscode.window.showQuickPick(Object.values(orgTypes));
      if (!selection) {
        return { type: 'CANCEL' };
      }

      const orgType = selection.label;
      if (orgType === orgTypes.custom?.label) {
        const customUrlInputOptions = {
          prompt: nls.localize('parameter_gatherer_enter_custom_url'),
          placeHolder: PRODUCTION_URL,
          validateInput: validateUrl
        };
        this.instanceUrl = await vscode.window.showInputBox(customUrlInputOptions);
        if (this.instanceUrl === undefined) {
          return { type: 'CANCEL' };
        }
      } else if (orgType === orgTypes.project?.label) {
        this.instanceUrl = await getProjectLoginUrl();
      } else {
        this.instanceUrl = orgType === 'Sandbox' ? SANDBOX_URL : PRODUCTION_URL;
      }
    }

    const alias = skipAlias
      ? `reauth-${DEFAULT_ALIAS}`
      : await vscode.window.showInputBox({
          prompt: nls.localize('parameter_gatherer_enter_alias_name'),
          placeHolder: DEFAULT_ALIAS
        });
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
