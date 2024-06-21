/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core-bundle';
import { assert, createSandbox, SinonStub } from 'sinon';
import { channelService } from '../../../../src/channels/index';
import {
  AccessTokenParamsGatherer,
  orgLoginAccessToken
} from '../../../../src/commands';
import { SfWorkspaceChecker } from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';

const sandbox = createSandbox();

describe('Org Login Access Token', () => {
  let workspaceCheckerStub: SinonStub;
  let accessTokenParamsGathererStub: SinonStub;
  let authInfoCreateStub: SinonStub;
  let handleAliasAndDefaultSettingsStub: SinonStub;
  let channelServiceStub: SinonStub;
  const mockAccessToken = 'mockAccessToken';
  const mockAlias = 'mockAlias';
  const mockInstanceUrl = 'https://na42.salesforce.com';

  beforeEach(() => {
    workspaceCheckerStub = sandbox.stub(SfWorkspaceChecker.prototype, 'check');
    workspaceCheckerStub.returns(true);
    accessTokenParamsGathererStub = sandbox.stub(
      AccessTokenParamsGatherer.prototype,
      'gather'
    );
    accessTokenParamsGathererStub.returns({
      type: 'CONTINUE',
      data: {
        accessToken: mockAccessToken,
        alias: mockAlias,
        instanceUrl: mockInstanceUrl
      }
    });
    authInfoCreateStub = sandbox.stub(AuthInfo, 'create');
    authInfoCreateStub.returns(
      new AuthInfo({
        accessTokenOptions: {
          accessToken: mockAccessToken,
          instanceUrl: mockInstanceUrl
        }
      })
    );
    handleAliasAndDefaultSettingsStub = sandbox
      .stub(AuthInfo.prototype, 'handleAliasAndDefaultSettings')
      .resolves();
    channelServiceStub = sandbox.stub(channelService, 'appendLine');
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('Should create and save auth info', async () => {
    await orgLoginAccessToken();
    assert.calledOnce(authInfoCreateStub);
    assert.calledWith(authInfoCreateStub, {
      accessTokenOptions: {
        accessToken: mockAccessToken,
        instanceUrl: mockInstanceUrl
      }
    });

    assert.calledWith(handleAliasAndDefaultSettingsStub, {
      alias: mockAlias,
      setDefault: true,
      setDefaultDevHub: false
    });
  });

  it('Should show a user friendly message on Bad_OAuth_Token', async () => {
    authInfoCreateStub.callsFake(() => {
      throw new Error(
        'Could not retrieve the username after successful auth code exchange.\nDue to: Bad_OAuth_Token'
      );
    });

    await orgLoginAccessToken();

    assert.calledOnce(channelServiceStub);
    assert.calledWith(
      channelServiceStub,
      nls.localize('org_login_access_token_bad_oauth_token_message')
    );
    assert.notCalled(handleAliasAndDefaultSettingsStub);
  });
});
