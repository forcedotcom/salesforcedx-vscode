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
  AuthParams,
  AuthParamsGatherer,
  createExecutor,
  DEFAULT_ALIAS,
  ForceAuthWebLoginDemoModeExecutor,
  ForceAuthWebLoginExecutor,
  OrgTypeItem,
  PRODUCTION_URL,
  SANDBOX_URL
} from '../../../src/commands/forceAuthWebLogin';
import { nls } from '../../../src/messages';

const TEST_ALIAS = 'testAlias';
const TEST_URL = 'https://my.testdomain.salesforce.com';

class TestForceAuthWebLoginExecutor extends ForceAuthWebLoginExecutor {
  public getShowChannelOutput() {
    return this.showChannelOutput;
  }
}

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
  let inputBoxSpy: sinon.SinonStub;
  let quickPickStub: sinon.SinonStub;
  let getProjectUrlStub: sinon.SinonStub;

  let gatherer: AuthParamsGatherer;

  const setGathererBehavior = (
    orgType: OrgTypeItem | undefined,
    customUrl: string | undefined,
    orgAlias: string | undefined
  ) => {
    quickPickStub.returns(orgType);
    let inputBoxCall = 0;
    if (orgType && orgType === gatherer.orgTypes.custom) {
      inputBoxSpy.onCall(inputBoxCall).returns(customUrl);
      inputBoxCall += 1;
    }
    inputBoxSpy.onCall(inputBoxCall).returns(orgAlias);
  };

  beforeEach(() => {
    gatherer = new AuthParamsGatherer();
    inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
    quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    getProjectUrlStub = sinon
      .stub(gatherer, 'getProjectLoginUrl')
      .returns(TEST_URL);
  });

  afterEach(() => {
    inputBoxSpy.restore();
    quickPickStub.restore();
    getProjectUrlStub.restore();
  });

  describe('Org Type Quick Pick Selection', () => {
    it('Should return Cancel if org type selection is undefined', async () => {
      setGathererBehavior(undefined, undefined, undefined);
      const response = await gatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should not give Project Default option is sfdcLoginUrl property doesn’t exist', async () => {
      getProjectUrlStub.returns(undefined);
      const items = await gatherer.getQuickPickItems();
      const { label } = gatherer.orgTypes.project;
      expect(items.length).to.equal(3);
      expect(items.some(i => i.label === label)).to.be.false;
    });

    it('Should return Continue with sfdcLoginUrl if Project Default is chosen', async () => {
      setGathererBehavior(gatherer.orgTypes.project, undefined, '');

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.loginUrl).to.equal(TEST_URL);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Cancel if custom loginUrl is undefined', async () => {
      setGathererBehavior(gatherer.orgTypes.custom, undefined, '');

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with inputted URL if custom URL user input is not undefined or empty', async () => {
      setGathererBehavior(gatherer.orgTypes.custom, TEST_URL, '');

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledTwice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.loginUrl).to.equal(TEST_URL);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should consider URL invalid if it does not begin with http:// or https://', async () => {
      expect(AuthParamsGatherer.validateUrl('http://example.com')).to.be.null;
      expect(AuthParamsGatherer.validateUrl('https://example.com')).to.be.null;
      expect(AuthParamsGatherer.validateUrl('example.com')).to.be.not.null;
    });

    it('Should return Continue with production URL if Production option is chosen', async () => {
      setGathererBehavior(gatherer.orgTypes.production, undefined, '');

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.loginUrl).to.equal(PRODUCTION_URL);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Continue with sandbox URL if Sandbox option is chosen', async () => {
      setGathererBehavior(gatherer.orgTypes.sandbox, undefined, '');

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.loginUrl).to.equal(SANDBOX_URL);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('Org Alias Input', () => {
    it('Should return Cancel if alias is undefined', async () => {
      setGathererBehavior(gatherer.orgTypes.production, undefined, undefined);

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with default alias if user input is empty string', async () => {
      setGathererBehavior(gatherer.orgTypes.production, undefined, '');

      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.alias).to.equal(DEFAULT_ALIAS);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Continue with inputted alias if user input is not undefined or empty', async () => {
      setGathererBehavior(gatherer.orgTypes.production, undefined, TEST_ALIAS);

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

describe('Force Auth Web Login is based on environment variables', () => {
  describe('in demo mode', () => {
    let originalValue: any;

    beforeEach(() => {
      originalValue = process.env.SFDX_ENV;
    });

    afterEach(() => {
      process.env.SFXD_ENV = originalValue;
    });

    it('Should use ForceAuthDevHubDemoModeExecutor if demo mode is true', () => {
      process.env.SFDX_ENV = 'DEMO';
      expect(createExecutor() instanceof ForceAuthWebLoginDemoModeExecutor).to
        .be.true;
    });

    it('Should use ForceAuthDevHubExecutor if demo mode is false', () => {
      process.env.SFDX_ENV = '';
      expect(createExecutor() instanceof ForceAuthWebLoginExecutor).to.be.true;
    });
  });

  describe('in container mode', () => {
    afterEach(() => {
      delete process.env.SFDX_CONTAINER_MODE;
    });
    it('Should expose the output channel when in container mode', () => {
      const notContainerMode = new TestForceAuthWebLoginExecutor();
      expect(notContainerMode.getShowChannelOutput()).to.be.false;
      process.env.SFDX_CONTAINER_MODE = 'true';
      const containerMode = new TestForceAuthWebLoginExecutor();
      expect(containerMode.getShowChannelOutput()).to.be.true;
    });
    it('Should use force:auth:web:login when container mode is not defined', () => {
      const authWebLogin = new ForceAuthWebLoginExecutor();
      const authWebLoginCommand = authWebLogin.build(
        ({} as unknown) as AuthParams
      );
      expect(authWebLoginCommand.toCommand()).to.equal(
        'sfdx force:auth:web:login --setalias  --instanceurl  --setdefaultusername'
      );
    });

    it('Should use force:auth:web:login when container mode is empty', () => {
      process.env.SFDX_CONTAINER_MODE = '';
      const authWebLogin = new ForceAuthWebLoginExecutor();
      const authWebLoginCommand = authWebLogin.build(
        ({} as unknown) as AuthParams
      );
      expect(authWebLoginCommand.toCommand()).to.equal(
        'sfdx force:auth:web:login --setalias  --instanceurl  --setdefaultusername'
      );
    });

    it('Should use force:auth:device:login when container mode is defined', () => {
      process.env.SFDX_CONTAINER_MODE = 'true';
      const authWebLogin = new ForceAuthWebLoginExecutor();
      const authWebLoginCommand = authWebLogin.build(
        ({} as unknown) as AuthParams
      );
      expect(authWebLoginCommand.toCommand()).to.equal(
        'sfdx force:auth:device:login --setalias  --instanceurl  --setdefaultusername'
      );
    });
  });
});
