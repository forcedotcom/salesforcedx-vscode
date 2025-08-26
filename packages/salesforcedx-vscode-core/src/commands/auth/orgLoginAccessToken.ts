/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, type AuthSideEffects } from '@salesforce/core';
import { LibraryCommandletExecutor, ContinueResponse, SfWorkspaceChecker } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../../channels/index';
import { nls } from '../../messages';
import { SfCommandlet } from '../util';
import { AccessTokenParams, AccessTokenParamsGatherer } from './authParamsGatherer';

class OrgLoginAccessTokenExecutor extends LibraryCommandletExecutor<AccessTokenParams> {
  constructor() {
    super(nls.localize('org_login_access_token_text'), 'org_login_access_token', OUTPUT_CHANNEL);
  }

  public async run(
    response: ContinueResponse<AccessTokenParams>,
    _progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    _token?: vscode.CancellationToken
  ): Promise<boolean> {
    const { instanceUrl, accessToken, alias } = response.data;
    try {
      const authInfo = await AuthInfo.create({
        accessTokenOptions: { accessToken, instanceUrl }
      });
      const sideEffects: AuthSideEffects = {
        alias,
        setDefault: true,
        setDefaultDevHub: false
      };
      await authInfo.handleAliasAndDefaultSettings(sideEffects);
    } catch (error) {
      if (error.message?.includes('Bad_OAuth_Token')) {
        // Provide a user-friendly message for invalid / expired session ID
        channelService.appendLine(nls.localize('org_login_access_token_bad_oauth_token_message'));
      }
      throw error;
    }

    return true;
  }
}

export const orgLoginAccessToken = async () => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new AccessTokenParamsGatherer(),
    new OrgLoginAccessTokenExecutor()
  );
  await commandlet.run();
};
