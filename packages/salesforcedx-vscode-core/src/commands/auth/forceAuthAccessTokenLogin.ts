/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

import { Aliases, AuthInfo } from '@salesforce/core';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { OUTPUT_CHANNEL } from '../../channels/index';
import { nls } from '../../messages';
import {
  notificationService,
  ProgressNotification
} from '../../notifications/index';
import { SfdxProjectConfig } from '../../sfdxProject';
import { taskViewService } from '../../statuses/index';
import { getRootWorkspacePath, isSFDXContainerMode } from '../../util';
import {
  CompositeParametersGatherer,
  DemoModePromptGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

import {
  AccessTokenParams,
  AccessTokenParamsGatherer,
  AuthParams
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

    const authInfo = await AuthInfo.create({
      accessTokenOptions: { accessToken, instanceUrl }
    });
    await authInfo.save();
    await authInfo.setAlias(alias);
    await authInfo.setAsDefault({
      defaultUsername: true
    });

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
