/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  createExecutor,
  ForceAuthDevHubDemoModeExecutor,
  ForceAuthDevHubExecutor
} from '../../src/commands/forceAuthDevHub';
import { nls } from '../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Auth Web Login for Dev Hub', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthDevHubExecutor();
    const authWebLoginCommand = authWebLogin.build({});
    expect(authWebLoginCommand.toCommand()).to.equal(
      'sfdx force:auth:web:login --setdefaultdevhubusername'
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
  });
});

describe('Force Auth Web Login For Dev Hub in Demo  Mode', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthDevHubDemoModeExecutor();
    const authWebLoginCommand = authWebLogin.build({});
    expect(authWebLoginCommand.toCommand()).to.equal(
      'sfdx force:auth:web:login --setdefaultdevhubusername --noprompt --json --loglevel fatal'
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
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
    expect(createExecutor() instanceof ForceAuthDevHubDemoModeExecutor).to.be
      .true;
  });

  it('Should use ForceAuthDevHubExecutor if demo mode is false', () => {
    process.env.SFDX_ENV = '';
    expect(createExecutor() instanceof ForceAuthDevHubExecutor).to.be.true;
  });
});
