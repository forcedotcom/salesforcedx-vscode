/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { instantiateContext } from '@salesforce/core-bundle';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  AuthDevHubParams,
  AuthDevHubParamsGatherer,
  createAuthDevHubExecutor,
  DEFAULT_ALIAS,
  OrgLoginWebDevHubContainerExecutor,
  OrgLoginWebDevHubDemoModeExecutor,
  OrgLoginWebDevHubExecutor
} from '../../../../src/commands';
import { nls } from '../../../../src/messages';

const TEST_ALIAS = 'testAlias';

class TestOrgLoginWebDevHubExecutor extends OrgLoginWebDevHubExecutor {
  public getShowChannelOutput() {
    return this.showChannelOutput;
  }
}

// tslint:disable:no-unused-expression
describe('Org Login Web for Dev Hub', () => {
  it('Should build the org login web login command', async () => {
    const orgLoginWeb = new OrgLoginWebDevHubExecutor();
    const orgLoginWebCommand = orgLoginWeb.build({
      alias: TEST_ALIAS
    });
    expect(orgLoginWebCommand.toCommand()).to.equal(`sf org:login:web --alias ${TEST_ALIAS} --set-default-dev-hub`);
    expect(orgLoginWebCommand.description).to.equal(nls.localize('org_login_web_authorize_dev_hub_text'));
  });
});

// Setup the test environment.
instantiateContext();

describe('Org Login Web For Dev Hub in Demo  Mode', () => {
  it('Should build the org login web login command', async () => {
    const orgLoginWeb = new OrgLoginWebDevHubDemoModeExecutor();
    const orgLoginWebCommand = orgLoginWeb.build({
      alias: TEST_ALIAS
    });
    expect(orgLoginWebCommand.toCommand()).to.equal(
      `sf org:login:web --alias ${TEST_ALIAS} --set-default-dev-hub --no-prompt --json`
    );
    expect(orgLoginWebCommand.description).to.equal(nls.localize('org_login_web_authorize_dev_hub_text'));
  });
});

describe('Auth Params Gatherer', () => {
  let inputBoxSpy: sinon.SinonStub;

  let gatherer: AuthDevHubParamsGatherer;

  const setGathererBehavior = (orgAlias: string | undefined) => {
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

describe('Org Login Web Dev Hub is based on environment variables', () => {
  describe('in demo mode', () => {
    let originalValue: any;

    beforeEach(() => {
      originalValue = process.env.SFDX_ENV;
    });

    afterEach(() => {
      process.env.SFDX_ENV = originalValue;
    });

    it('Should use OrgLoginWebDevHubDemoModeExecutor if demo mode is true', () => {
      process.env.SFDX_ENV = 'DEMO';
      expect(createAuthDevHubExecutor() instanceof OrgLoginWebDevHubDemoModeExecutor).to.be.true;
    });

    it('Should use OrgLoginWebDevHubExecutor if demo mode is false', () => {
      process.env.SFDX_ENV = '';
      expect(createAuthDevHubExecutor() instanceof OrgLoginWebDevHubExecutor).to.be.true;
    });
  });

  describe('in container mode', () => {
    afterEach(() => {
      delete process.env.SF_CONTAINER_MODE;
    });
    it('Should not expose the output channel when not in container mode', () => {
      const notContainerMode = new TestOrgLoginWebDevHubExecutor();
      expect(notContainerMode.getShowChannelOutput()).to.be.false;
    });

    it('Should use OrgLoginWebDevHubExecutor when container mode is not defined', () => {
      const orgLoginWeb = new OrgLoginWebDevHubExecutor();
      expect(createAuthDevHubExecutor() instanceof OrgLoginWebDevHubExecutor).to.be.true;
      const orgLoginWebCommand = orgLoginWeb.build({} as unknown as AuthDevHubParams);
      expect(orgLoginWebCommand.toCommand()).to.equal('sf org:login:web --alias  --set-default-dev-hub');
    });

    it('Should use OrgLoginWebDevHubExecutor when container mode is empty', () => {
      process.env.SF_CONTAINER_MODE = '';
      const orgLoginWeb = new OrgLoginWebDevHubExecutor();
      expect(createAuthDevHubExecutor() instanceof OrgLoginWebDevHubExecutor).to.be.true;
      const orgLoginWebCommand = orgLoginWeb.build({} as unknown as AuthDevHubParams);
      expect(orgLoginWebCommand.toCommand()).to.equal('sf org:login:web --alias  --set-default-dev-hub');
    });

    it('Should use OrgLoginWebDevHubContainerExecutor when container mode is defined', () => {
      process.env.SF_CONTAINER_MODE = 'true';
      const authDevhubLogin = new OrgLoginWebDevHubContainerExecutor();
      expect(createAuthDevHubExecutor() instanceof OrgLoginWebDevHubContainerExecutor).to.be.true;
      const authDevhubLoginCommand = authDevhubLogin.build({} as unknown as AuthDevHubParams);
      expect(authDevhubLoginCommand.toCommand()).to.equal('sf org:login:device --alias  --set-default-dev-hub --json');
      expect(authDevhubLoginCommand.description).to.equal(nls.localize('org_login_web_authorize_dev_hub_text'));
    });
  });
});
