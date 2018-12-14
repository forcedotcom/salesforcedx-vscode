/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  AuthParamsGatherer,
  createExecutor,
  DEFAULT_ALIAS,
  ForceAuthWebLoginDemoModeExecutor,
  ForceAuthWebLoginExecutor,
  PRODUCTION_URL,
  SANDBOX_URL
} from '../../src/commands/forceAuthWebLogin';
import { nls } from '../../src/messages';

const TEST_ALIAS = 'testAlias';
const TEST_URL = 'https://my.testdomain.salesforce.com';

// tslint:disable:no-unused-expression
describe('Force Auth Web Login', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthWebLoginExecutor();
    const authWebLoginCommand = authWebLogin.build({
      alias: TEST_ALIAS,
      loginUrl: TEST_URL
    });
    expect(authWebLoginCommand.toCommand()).to.equal(
      `sfdx force:auth:web:login --setalias ${TEST_ALIAS} --instanceurl ${TEST_URL} --setdefaultusername`
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_org_text')
    );
  });
});

describe('Force Auth Web Login in Demo  Mode', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthWebLoginDemoModeExecutor();
    const authWebLoginCommand = authWebLogin.build({
      alias: TEST_ALIAS,
      loginUrl: TEST_URL
    });
    expect(authWebLoginCommand.toCommand()).to.equal(
      `sfdx force:auth:web:login --setalias ${TEST_ALIAS} --instanceurl ${TEST_URL} --setdefaultusername --noprompt --json --loglevel fatal`
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_org_text')
    );
  });
});

describe('Auth Params Gatherer', () => {
  const inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
  const quickPickStub = sinon.stub(vscode.window, 'showQuickPick');

  afterEach(() => {
    inputBoxSpy.reset();
    quickPickStub.reset();
  });

  it('Should return cancel if custom loginUrl is undefined', async () => {
    quickPickStub.returns({ label: 'Custom' });
    inputBoxSpy.returns(undefined);

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledOnce).to.be.true;
    expect(response.type).to.equal('CANCEL');
  });

  it('Should return Continue with production URL if custom URL user input is an empty string', async () => {
    quickPickStub.returns({ label: 'Custom' });
    inputBoxSpy.onCall(0).returns('');
    inputBoxSpy.onCall(1).returns('');

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledTwice).to.be.true;
    if (response.type === 'CONTINUE') {
      expect(response.data.loginUrl).to.equal(PRODUCTION_URL);
    } else {
      expect.fail('Response should be of type ContinueResponse');
    }
  });

  it('Should return Continue with inputted URL if custom URL user input is not undefined or empty', async () => {
    quickPickStub.returns({ label: 'Custom' });
    inputBoxSpy.onCall(0).returns(TEST_URL);
    inputBoxSpy.onCall(1).returns('');

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledTwice).to.be.true;
    if (response.type === 'CONTINUE') {
      expect(response.data.loginUrl).to.equal(TEST_URL);
    } else {
      expect.fail('Response should be of type ContinueResponse');
    }
  });

  it('Should return Continue with production URL if Production option is chosen', async () => {
    quickPickStub.returns({ label: 'Production' });
    inputBoxSpy.returns('');

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledOnce).to.be.true;
    if (response.type === 'CONTINUE') {
      expect(response.data.loginUrl).to.equal(PRODUCTION_URL);
    } else {
      expect.fail('Response should be of type ContinueResponse');
    }
  });

  it('Should return Continue with sandbox URL if Sandbox option is chosen', async () => {
    quickPickStub.returns({ label: 'Sandbox' });
    inputBoxSpy.returns('');

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledOnce).to.be.true;
    if (response.type === 'CONTINUE') {
      expect(response.data.loginUrl).to.equal(SANDBOX_URL);
    } else {
      expect.fail('Response should be of type ContinueResponse');
    }
  });

  it('Should return cancel if alias is undefined', async () => {
    quickPickStub.returns({ label: 'Production' });
    inputBoxSpy.returns(undefined);

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledOnce).to.be.true;
    expect(response.type).to.equal('CANCEL');
  });

  it('Should return Continue with default alias if user input is empty string', async () => {
    quickPickStub.returns({ label: 'Production' });
    inputBoxSpy.returns('');

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledOnce).to.be.true;
    if (response.type === 'CONTINUE') {
      expect(response.data.alias).to.equal(DEFAULT_ALIAS);
    } else {
      expect.fail('Response should be of type ContinueResponse');
    }
  });

  it('Should return Continue with inputted alias if user input is not undefined or empty', async () => {
    quickPickStub.returns({ label: 'Production' });
    inputBoxSpy.returns(TEST_ALIAS);

    const gatherer = new AuthParamsGatherer();
    const response = await gatherer.gather();

    expect(inputBoxSpy.calledOnce).to.be.true;
    if (response.type === 'CONTINUE') {
      expect(response.data.alias).to.equal(TEST_ALIAS);
    } else {
      expect.fail('Response should be of type ContinueResponse');
    }
  });
});

describe('Command chosen is based on results of isDemoMode()', () => {
  let originalValue: any;

  beforeEach(() => {
    originalValue = process.env.SFDX_ENV;
  });

  afterEach(() => {
    process.env.SFXD_ENV = originalValue;
  });

  it('Should use ForceAuthDevHubDemoModeExecutor if demo mode is true', () => {
    process.env.SFDX_ENV = 'DEMO';
    expect(createExecutor() instanceof ForceAuthWebLoginDemoModeExecutor).to.be
      .true;
  });

  it('Should use ForceAuthDevHubExecutor if demo mode is false', () => {
    process.env.SFDX_ENV = '';
    expect(createExecutor() instanceof ForceAuthWebLoginExecutor).to.be.true;
  });
});
