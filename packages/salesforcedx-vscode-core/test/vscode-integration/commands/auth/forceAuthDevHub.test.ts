/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigFile } from '@salesforce/core';
import {
  instantiateContext,
  restoreContext,
  stubContext
} from '@salesforce/core/lib/testSetup';
import { ConfigSource } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  AuthDevHubParams,
  AuthDevHubParamsGatherer,
  createAuthDevHubExecutor,
  DEFAULT_ALIAS,
  ForceAuthDevHubContainerExecutor,
  ForceAuthDevHubDemoModeExecutor,
  ForceAuthDevHubExecutor
} from '../../../../src/commands';
import { DEFAULT_DEV_HUB_USERNAME_KEY } from '../../../../src/constants';
import { nls } from '../../../../src/messages';
import { OrgAuthInfo } from '../../../../src/util';

const TEST_ALIAS = 'testAlias';

class TestForceAuthDevHubExecutor extends ForceAuthDevHubExecutor {
  public getShowChannelOutput() {
    return this.showChannelOutput;
  }
}

// tslint:disable:no-unused-expression
describe('Force Auth Web Login for Dev Hub', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthDevHubExecutor();
    const authWebLoginCommand = authWebLogin.build({
      alias: TEST_ALIAS
    });
    expect(authWebLoginCommand.toCommand()).to.equal(
      `sfdx force:auth:web:login --setalias ${TEST_ALIAS} --setdefaultdevhubusername`
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
  });
});

// Setup the test environment.
const $$ = instantiateContext();

describe('configureDefaultDevHubLocation on processExit of ForceAuthDevHubExecutor', () => {
  let getDefaultDevHubUsernameStub: SinonStub;
  let setGlobalDefaultDevHubStub: SinonStub;
  let configWriteStub: SinonSpy;
  let configSetStub: SinonSpy;
  let configCreateSpy: SinonSpy;

  const authWebLogin = ForceAuthDevHubExecutor.prototype;
  let sb: SinonSandbox;

  beforeEach(() => {
    stubContext($$);
    $$.SANDBOXES.CONFIG.restore();
    sb = $$.SANDBOX;
    getDefaultDevHubUsernameStub = sb.stub(
      OrgAuthInfo,
      'getDefaultDevHubUsernameOrAlias'
    );
    setGlobalDefaultDevHubStub = sb.stub(
      authWebLogin,
      'setGlobalDefaultDevHub'
    );
    configWriteStub = sb.spy(ConfigFile.prototype, 'write');
    configSetStub = sb.spy(ConfigFile.prototype, 'set');
    configCreateSpy = sb.spy(ConfigFile, 'create');
  });

  afterEach(() => {
    restoreContext($$);
  });

  it('Should set global dev hub if there is no global already, but a local has been defined', async () => {
    getDefaultDevHubUsernameStub.onCall(0).returns(undefined);
    getDefaultDevHubUsernameStub.onCall(1).returns('test@test.com');

    await authWebLogin.configureDefaultDevHubLocation();

    expect(setGlobalDefaultDevHubStub.called).to.equal(true);
    expect(
      getDefaultDevHubUsernameStub.calledWith(false, ConfigSource.Global)
    ).to.equal(true);
    expect(
      getDefaultDevHubUsernameStub.calledWith(false, ConfigSource.Local)
    ).to.equal(true);
    expect(getDefaultDevHubUsernameStub.calledTwice).to.be.true;
  });

  it('Should do nothing if there is no local dev hub to refer to', async () => {
    getDefaultDevHubUsernameStub.returns(undefined);

    await authWebLogin.configureDefaultDevHubLocation();

    expect(setGlobalDefaultDevHubStub.called).to.equal(false);
    expect(getDefaultDevHubUsernameStub.calledTwice).to.equal(true);
    expect(
      getDefaultDevHubUsernameStub.calledWith(false, ConfigSource.Global)
    ).to.equal(true);
    expect(
      getDefaultDevHubUsernameStub.calledWith(false, ConfigSource.Local)
    ).to.equal(true);
  });

  it('Should call set and write on the config file', async () => {
    setGlobalDefaultDevHubStub.restore();
    const testUsername = 'test@test.com';

    await authWebLogin.setGlobalDefaultDevHub(testUsername);

    expect(configCreateSpy.getCall(0).args[0].isGlobal).to.be.true;
    expect(
      configSetStub.calledWith(DEFAULT_DEV_HUB_USERNAME_KEY, testUsername)
    ).to.equal(true);
    expect(configWriteStub.calledOnce).to.equal(true);
    expect(configSetStub.calledOnce).to.equal(true);
  });
});

describe('Force Auth Web Login For Dev Hub in Demo  Mode', () => {
  it('Should build the auth web login command', async () => {
    const authWebLogin = new ForceAuthDevHubDemoModeExecutor();
    const authWebLoginCommand = authWebLogin.build({
      alias: TEST_ALIAS
    });
    expect(authWebLoginCommand.toCommand()).to.equal(
      `sfdx force:auth:web:login --setalias ${TEST_ALIAS} --setdefaultdevhubusername --noprompt --json --loglevel fatal`
    );
    expect(authWebLoginCommand.description).to.equal(
      nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
  });
});

describe('Auth Params Gatherer', () => {
  let inputBoxSpy: sinon.SinonStub;

  let gatherer: AuthDevHubParamsGatherer;

  const setGathererBehavior = (
    orgAlias: string | undefined
  ) => {
    inputBoxSpy.onCall(0).returns(orgAlias);
  };

  beforeEach(() => {
    gatherer = new AuthDevHubParamsGatherer();
    inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
  });

  afterEach(() => {
    inputBoxSpy.restore();
  });

  describe('Org Alias Input', () => {
    it('Should return Cancel if alias is undefined', async () => {
      setGathererBehavior(undefined);

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with default alias if user input is empty string', async () => {
      setGathererBehavior('');

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.alias).to.equal(DEFAULT_ALIAS);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Continue with inputted alias if user input is not undefined or empty', async () => {
      setGathererBehavior(TEST_ALIAS);

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.alias).to.equal(TEST_ALIAS);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });
});

describe('Force Auth Dev Hub is based on environment variables', () => {
  describe('in demo mode', () => {
    let originalValue: any;

    beforeEach(() => {
      originalValue = process.env.SFDX_ENV;
    });

    afterEach(() => {
      process.env.SFDX_ENV = originalValue;
    });

    it('Should use ForceAuthDevHubDemoModeExecutor if demo mode is true', () => {
      process.env.SFDX_ENV = 'DEMO';
      expect(
        createAuthDevHubExecutor() instanceof ForceAuthDevHubDemoModeExecutor
      ).to.be.true;
    });

    it('Should use ForceAuthDevHubExecutor if demo mode is false', () => {
      process.env.SFDX_ENV = '';
      expect(createAuthDevHubExecutor() instanceof ForceAuthDevHubExecutor).to
        .be.true;
    });
  });

  describe('in container mode', () => {
    afterEach(() => {
      delete process.env.SFDX_CONTAINER_MODE;
    });
    it('Should not expose the output channel when not in container mode', () => {
      const notContainerMode = new TestForceAuthDevHubExecutor();
      expect(notContainerMode.getShowChannelOutput()).to.be.false;
    });

    it('Should use ForceAuthDevHubExecutor when container mode is not defined', () => {
      const authWebLogin = new ForceAuthDevHubExecutor();
      expect(createAuthDevHubExecutor() instanceof ForceAuthDevHubExecutor).to.be.true;
      const authWebLoginCommand = authWebLogin.build(({} as unknown) as AuthDevHubParams);
      expect(authWebLoginCommand.toCommand()).to.equal(
        'sfdx force:auth:web:login --setalias  --setdefaultdevhubusername'
      );
    });

    it('Should use ForceAuthDevHubExecutor when container mode is empty', () => {
      process.env.SFDX_CONTAINER_MODE = '';
      const authWebLogin = new ForceAuthDevHubExecutor();
      expect(createAuthDevHubExecutor() instanceof ForceAuthDevHubExecutor).to.be.true;
      const authWebLoginCommand = authWebLogin.build(({} as unknown) as AuthDevHubParams);
      expect(authWebLoginCommand.toCommand()).to.equal(
        'sfdx force:auth:web:login --setalias  --setdefaultdevhubusername'
      );
    });

    it('Should use ForceAuthDevHubContainerExecutor when container mode is defined', () => {
      process.env.SFDX_CONTAINER_MODE = 'true';
      const authWebLogin = new ForceAuthDevHubContainerExecutor();
      expect(
        createAuthDevHubExecutor() instanceof ForceAuthDevHubContainerExecutor
      ).to.be.true;
      const authWebLoginCommand = authWebLogin.build(({} as unknown) as AuthDevHubParams);
      expect(authWebLoginCommand.toCommand()).to.equal(
        'sfdx force:auth:device:login --setalias  --setdefaultdevhubusername'
      );
    });

    it('should build the force:auth:device:login command', () => {
      const authDevHubLogin = new ForceAuthDevHubContainerExecutor();
      const authDevhubLoginCommand = authDevHubLogin.build({});
      expect(authDevhubLoginCommand.toCommand()).to.equal(
        `sfdx force:auth:device:login --setdefaultdevhubusername --json --loglevel fatal`
      );
      expect(authDevhubLoginCommand.description).to.equal(
        nls.localize('force_auth_web_login_authorize_dev_hub_text')
      );
    });
  });
});
