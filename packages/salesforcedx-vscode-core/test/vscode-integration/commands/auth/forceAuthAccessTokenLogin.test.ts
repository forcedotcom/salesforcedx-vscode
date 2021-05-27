/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core';
import { assert, createSandbox, SinonStub } from 'sinon';
import {
  AccessTokenParamsGatherer,
  forceAuthAccessToken
} from '../../../../src/commands';
import { SfdxWorkspaceChecker } from '../../../../src/commands/util';

const sandbox = createSandbox();

describe('Force Auth Access Token Login', () => {
  let workspaceCheckerStub: SinonStub;
  let accessTokenParamsGathererStub: SinonStub;
  let authInfoCreateStub: SinonStub;
  let authInfoSaveStub: SinonStub;
  let authInfoSetAliasStub: SinonStub;
  let authInfoSetAsDefaultStub: SinonStub;
  const mockAccessToken = 'mockAccessToken';
  const mockAlias = 'mockAlias';
  const mockInstanceUrl = 'https://na42.salesforce.com';

  beforeEach(() => {
    workspaceCheckerStub = sandbox.stub(
      SfdxWorkspaceChecker.prototype,
      'check'
    );
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
    authInfoSaveStub = sandbox.stub(AuthInfo.prototype, 'save');
    authInfoSetAliasStub = sandbox.stub(AuthInfo.prototype, 'setAlias');
    authInfoSetAsDefaultStub = sandbox.stub(AuthInfo.prototype, 'setAsDefault');
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('Should create and save auth info', async () => {
    await forceAuthAccessToken();
    assert.calledOnce(authInfoCreateStub);
    assert.calledWith(authInfoCreateStub, {
      accessTokenOptions: {
        accessToken: mockAccessToken,
        instanceUrl: mockInstanceUrl
      }
    });
    assert.calledOnce(authInfoSaveStub);
    assert.calledOnce(authInfoSetAliasStub);
    assert.calledWith(authInfoSetAliasStub, mockAlias);
    assert.calledOnce(authInfoSetAsDefaultStub);
    assert.calledWith(authInfoSetAsDefaultStub, {
      defaultUsername: true
    });
  });
});
