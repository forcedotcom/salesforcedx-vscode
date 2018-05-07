/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  createExecutor,
  ForceAuthWebDemoModeLoginExecutor,
  ForceAuthWebLoginExecutor
} from '../../src/commands/forceAuthWebLogin';
import { nls } from '../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Auth Web Login', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthWebLoginExecutor();
    const authWebLoginCommand = authWebLogin.build({});
    expect(authWebLoginCommand.toCommand()).to.equal(
      'sfdx force:auth:web:login --setdefaultdevhubusername'
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
  });
});

describe('Force Auth Web Login for Demo  Mode', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthWebDemoModeLoginExecutor();
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

  it('Should use ForceAuthWebDemoModeLoginExecutor if demo mode is true', () => {
    process.env.SFDX_ENV = 'DEMO';
    expect(createExecutor() instanceof ForceAuthWebDemoModeLoginExecutor).to.be
      .true;
  });

  it('Should use ForceAuthWebLoginExecutor if demo mode is false', () => {
    process.env.SFDX_ENV = '';
    expect(createExecutor() instanceof ForceAuthWebLoginExecutor).to.be.true;
  });
});
