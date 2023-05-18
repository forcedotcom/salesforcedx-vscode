/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

import { AuthInfo, AuthSideEffects } from '@salesforce/core';
import { LibraryCommandletExecutor, channelService } from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { OUTPUT_CHANNEL } from '../../channels/index';
import { nls } from '../../messages';
import { SfdxCommandlet, SfdxWorkspaceChecker } from '../util';
import {
  AccessTokenParams,
  AccessTokenParamsGatherer
} from './authParamsGatherer';

export class ForceAuthAccessTokenExecutor extends LibraryCommandletExecutor<
  AccessTokenParams
> {
  constructor() {
    super(
      nls.localize('force_auth_access_token_authorize_org_text'),
      'force_auth_access_token',
      OUTPUT_CHANNEL
    );
  }

  public async run(
    response: ContinueResponse<AccessTokenParams>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
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
      if (error.message && error.message.includes('Bad_OAuth_Token')) {
        // Provide a user-friendly message for invalid / expired session ID
        channelService.appendLine(
          nls.localize('force_auth_access_token_login_bad_oauth_token_message')
        );
      }
      throw error;
    }

    return true;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new AccessTokenParamsGatherer();

export async function forceAuthAccessToken() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceAuthAccessTokenExecutor()
  );
  await commandlet.run();
}
