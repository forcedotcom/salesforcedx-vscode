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
  AliasGatherer,
  createExecutor,
  DEFAULT_ALIAS,
  ForceAuthWebLoginDemoModeExecutor,
  ForceAuthWebLoginExecutor
} from '../../src/commands/forceAuthWebLogin';
import { nls } from '../../src/messages';

const TEST_ALIAS = 'testAlias';

// tslint:disable:no-unused-expression
describe('Force Auth Web Login', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthWebLoginExecutor();
    const authWebLoginCommand = authWebLogin.build({ alias: TEST_ALIAS });
    expect(authWebLoginCommand.toCommand()).to.equal(
      `sfdx force:auth:web:login --setalias ${TEST_ALIAS} --setdefaultusername`
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_org_text')
    );
  });
});

describe('Force Auth Web Login in Demo  Mode', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthWebLoginDemoModeExecutor();
    const authWebLoginCommand = authWebLogin.build({ alias: TEST_ALIAS });
    expect(authWebLoginCommand.toCommand()).to.equal(
      `sfdx force:auth:web:login --setalias ${TEST_ALIAS} --setdefaultusername --noprompt --json --loglevel fatal`
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_org_text')
    );
  });
});

describe('Alias Gatherer', () => {
  let inputBoxSpy: sinon.SinonStub;

  before(() => {
    inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
    inputBoxSpy.onCall(0).returns(undefined);
    inputBoxSpy.onCall(1).returns('');
    inputBoxSpy.onCall(2).returns(TEST_ALIAS);
  });

  after(() => {
    inputBoxSpy.restore();
  });

  it('Should return cancel if alias is undefined', async () => {
    const gatherer = new AliasGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledOnce).to.be.true;
    expect(response.type).to.equal('CANCEL');
  });

  it('Should return Continue with default alias if user input is empty string', async () => {
    const gatherer = new AliasGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledTwice).to.be.true;
    if (response.type === 'CONTINUE') {
      expect(response.data.alias).to.equal(DEFAULT_ALIAS);
    } else {
      expect.fail('Response should be of type ContinueResponse');
    }
  });

  it('Should return Continue with inputted alias if user input is not undefined or empty', async () => {
    const gatherer = new AliasGatherer();
    const response = await gatherer.gather();
    expect(inputBoxSpy.calledThrice).to.be.true;
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
