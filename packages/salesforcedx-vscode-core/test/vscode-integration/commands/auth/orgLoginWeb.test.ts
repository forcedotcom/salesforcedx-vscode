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
  createOrgLoginWebExecutor,
  DEFAULT_ALIAS,
  DeviceCodeResponse,
  OrgLoginWebContainerExecutor,
  OrgLoginWebDemoModeExecutor,
  OrgLoginWebExecutor,
  OrgTypeItem,
  PRODUCTION_URL,
  SANDBOX_URL
} from '../../../../src/commands';
import { nls } from '../../../../src/messages';

const TEST_ALIAS = 'testAlias';
const TEST_URL = 'https://my.testdomain.salesforce.com';

describe('Org Login Web', () => {
  it('Should build the org login web login command', async () => {
    const orgLoginWeb = new OrgLoginWebExecutor();
    const orgLoginWebCommand = orgLoginWeb.build({
      alias: TEST_ALIAS,
      loginUrl: TEST_URL
    });
    expect(orgLoginWebCommand.toCommand()).to.equal(
      `sf org:login:web --alias ${TEST_ALIAS} --instance-url ${TEST_URL} --set-default`
    );
    expect(orgLoginWebCommand.description).to.equal(nls.localize('org_login_web_authorize_org_text'));
  });
});

describe('Org Login Web in Demo Mode', () => {
  it('Should build the org login web login command', async () => {
    const orgLoginWeb = new OrgLoginWebDemoModeExecutor();
    const orgLoginWebCommand = orgLoginWeb.build({
      alias: TEST_ALIAS,
      loginUrl: TEST_URL
    });
    expect(orgLoginWebCommand.toCommand()).to.equal(
      `sf org:login:web --alias ${TEST_ALIAS} --instance-url ${TEST_URL} --set-default --no-prompt --json`
    );
    expect(orgLoginWebCommand.description).to.equal(nls.localize('org_login_web_authorize_org_text'));
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
    getProjectUrlStub = sinon.stub(gatherer, 'getProjectLoginUrl').returns(TEST_URL);
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

describe('Org Login Web is based on environment variables', () => {
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
      expect(createOrgLoginWebExecutor() instanceof OrgLoginWebDemoModeExecutor).to.be.true;
    });

    it('Should use OrgLoginWebDevHubExecutor if demo mode is false', () => {
      process.env.SFDX_ENV = '';
      expect(createOrgLoginWebExecutor() instanceof OrgLoginWebExecutor).to.be.true;
    });
  });

  describe('in container mode', () => {
    afterEach(() => {
      delete process.env.SF_CONTAINER_MODE;
    });

    it('Should use OrgLoginWebExecutor when container mode is not defined', () => {
      expect(createOrgLoginWebExecutor() instanceof OrgLoginWebExecutor).to.be.true;
    });

    it('Should use OrgLoginWebExecutor when container mode is empty', () => {
      process.env.SF_CONTAINER_MODE = '';
      expect(createOrgLoginWebExecutor() instanceof OrgLoginWebExecutor).to.be.true;
    });

    it('Should use OrgLoginWebContainerExecutor when container mode is defined', () => {
      process.env.SF_CONTAINER_MODE = 'true';
      expect(createOrgLoginWebExecutor() instanceof OrgLoginWebContainerExecutor).to.be.true;
    });

    it('should build the org:login:device command', () => {
      const orgLoginWeb = new OrgLoginWebContainerExecutor();
      const orgLoginWebCommand = orgLoginWeb.build({
        alias: TEST_ALIAS,
        loginUrl: TEST_URL
      });
      expect(orgLoginWebCommand.toCommand()).to.equal(
        `sf org:login:device --alias ${TEST_ALIAS} --instance-url ${TEST_URL} --set-default --json`
      );
      expect(orgLoginWebCommand.description).to.equal(nls.localize('org_login_web_authorize_org_text'));
    });
  });
});

describe('Org Login Web Container', () => {
  class TestOrgLoginWebContainer extends OrgLoginWebContainerExecutor {
    public deviceCodeReceived = false;
    public stdOut = '';

    public injectResponse(data: string) {
      this.handleCliResponse(data);
    }
  }

  let sb: sinon.SinonSandbox;
  let deviceExecutor: TestOrgLoginWebContainer;
  const testResponse: Partial<DeviceCodeResponse> = {
    user_code: '1234',
    verification_uri: 'http://example.com'
  };

  beforeEach(() => {
    deviceExecutor = new TestOrgLoginWebContainer();

    sb = sinon.createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should open and external link to the correct url', () => {
    const openExternal = sb.stub(vscode.env, 'openExternal');
    const responseStr = JSON.stringify(testResponse);
    deviceExecutor.injectResponse(responseStr);

    expect(deviceExecutor.stdOut).to.be.equal(responseStr);
    expect(openExternal.called).to.be.true;
    expect(deviceExecutor.deviceCodeReceived).to.be.true;

    const uri: vscode.Uri = openExternal.getCall(0).args as unknown as vscode.Uri;
    const targetUrl = uri.toString();
    expect(targetUrl).to.contain(testResponse.verification_uri);
    expect(targetUrl).to.contain(testResponse.user_code);
    expect(targetUrl).to.contain('user_code');
    expect(targetUrl).to.contain('prompt%3Dlogin');
  });

  it('should handle partial data from CLI stdOut', () => {
    const openExternal = sb.stub(vscode.env, 'openExternal');
    const responseStr1 = '{"user_code":"1234","verification';
    deviceExecutor.injectResponse(responseStr1);

    expect(deviceExecutor.stdOut).to.be.equal(responseStr1);
    expect(openExternal.called).to.be.false;
    expect(deviceExecutor.deviceCodeReceived).to.be.false;

    const responseStr2 = '_uri":"http://example.com"}';
    deviceExecutor.injectResponse(responseStr2);
    expect(deviceExecutor.stdOut).to.be.equal(`${responseStr1}${responseStr2}`);
    expect(openExternal.called).to.be.true;
    expect(deviceExecutor.deviceCodeReceived).to.be.true;
  });

  it('should not open a browser if CLI responds with unexpected or bad data', () => {
    const openExternal = sb.stub(vscode.env, 'openExternal');
    const responseStr = JSON.stringify({
      error: 500,
      message: 'something went wrong'
    });
    deviceExecutor.injectResponse(responseStr);

    expect(deviceExecutor.stdOut).to.be.equal(responseStr);
    expect(openExternal.called).to.be.false;
    expect(deviceExecutor.deviceCodeReceived).to.be.false;
  });
});
