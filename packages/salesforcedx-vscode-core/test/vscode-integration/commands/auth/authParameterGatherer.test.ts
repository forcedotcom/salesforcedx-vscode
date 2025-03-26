/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { assert, createSandbox, match, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { AccessTokenParamsGatherer, DEFAULT_ALIAS, INSTANCE_URL_PLACEHOLDER } from '../../../../src/commands';
import { nls } from '../../../../src/messages';

const sandbox = createSandbox();

describe('Auth Parameter Gatherer', () => {
  describe('Access Token Params Gatherer', () => {
    let inputStub: SinonStub;
    let gatherer: AccessTokenParamsGatherer;
    const mockInputInstanceUrl = 'https://na42.salesforce.com';
    const mockInputAlias = 'myOrg';
    const mockInputAccessToken = 'mockAccessToken';
    const setGathererBehavior = (
      instanceUrl: string | undefined,
      alias: string | undefined,
      accessToken: string | undefined
    ) => {
      inputStub.onCall(0).returns(instanceUrl);
      inputStub.onCall(1).returns(alias);
      inputStub.onCall(2).returns(accessToken);
    };
    beforeEach(() => {
      gatherer = new AccessTokenParamsGatherer();
      inputStub = sandbox.stub(vscode.window, 'showInputBox');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('Should return Cancel if instance URL is undefined', async () => {
      setGathererBehavior(undefined, undefined, undefined);
      const response = await gatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Cancel if instance URL is invalid', async () => {
      setGathererBehavior('invalidUrl', undefined, undefined);
      const response = await gatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Cancel if alias is undefined', async () => {
      setGathererBehavior(mockInputInstanceUrl, undefined, undefined);
      const response = await gatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Cancel if access token is undefined', async () => {
      setGathererBehavior(mockInputInstanceUrl, mockInputAlias, undefined);
      const response = await gatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return show localized prompts and placeholders', async () => {
      setGathererBehavior(mockInputInstanceUrl, mockInputAlias, mockInputAccessToken);
      await gatherer.gather();
      assert.calledWith(
        inputStub,
        match({
          prompt: nls.localize('parameter_gatherer_enter_instance_url'),
          placeHolder: INSTANCE_URL_PLACEHOLDER,
          ignoreFocusOut: true
        })
      );
      assert.calledWith(
        inputStub,
        match({
          prompt: nls.localize('parameter_gatherer_enter_alias_name'),
          placeHolder: DEFAULT_ALIAS,
          ignoreFocusOut: true
        })
      );
      assert.calledWith(
        inputStub,
        match({
          prompt: nls.localize('parameter_gatherer_enter_session_id'),
          placeHolder: nls.localize('parameter_gatherer_enter_session_id_placeholder'),
          ignoreFocusOut: true
        })
      );
    });

    it('Should return Continue if user has input instance url, alias and access token', async () => {
      setGathererBehavior(mockInputInstanceUrl, mockInputAlias, mockInputAccessToken);
      const response = await gatherer.gather();
      expect(response).to.eql({
        type: 'CONTINUE',
        data: {
          instanceUrl: mockInputInstanceUrl,
          alias: mockInputAlias,
          accessToken: mockInputAccessToken
        }
      });
    });

    it('Should return Continue if user has input instance url, empty alias and access token', async () => {
      setGathererBehavior(mockInputInstanceUrl, '', mockInputAccessToken);
      const response = await gatherer.gather();
      expect(response).to.eql({
        type: 'CONTINUE',
        data: {
          instanceUrl: mockInputInstanceUrl,
          alias: DEFAULT_ALIAS,
          accessToken: mockInputAccessToken
        }
      });
    });
  });
});
