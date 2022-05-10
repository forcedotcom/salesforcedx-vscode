/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* tslint:disable:no-unused-expression */
import { Aliases, AuthInfo } from '@salesforce/core';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ENABLE_ORG_BROWSER_AND_DEPLOY_AND_RETRIEVE_FOR_SOURCE_TRACKED_ORGS
} from '../../../src/constants';
import {
  getDefaultUsernameOrAlias,
  getWorkspaceOrgType,
  OrgType,
  setupWorkspaceOrgType,
  setWorkspaceOrgTypeWithOrgType
} from '../../../src/context';
import { sfdxCoreSettings } from '../../../src/settings';
import { OrgAuthInfo } from '../../../src/util';

describe('getDefaultUsernameOrAlias', () => {
  it('returns undefined when no defaultusername is set', async () => {
    const getConfigStub = getDefaultUsernameStub(undefined);
    expect(await getDefaultUsernameOrAlias()).to.be.undefined;
    getConfigStub.restore();
  });

  it('returns the defaultusername when the username is set', async () => {
    const username = 'test@org.com';
    const getConfigStub = getDefaultUsernameStub(username);
    expect(await getDefaultUsernameOrAlias()).to.equal(username);
    getConfigStub.restore();
  });
});

describe('getWorkspaceOrgType', () => {
  it('returns the source-tracked org type', async () => {
    const defaultUsername = 'scratchOrgAlias';
    const aliasesStub = getAliasesFetchStub('scratch@org.com');
    const authInfoCreateStub = getAuthInfoCreateStub({
      getFields: () => ({
        devHubUsername: 'dev@hub.com'
      })
    });

    const orgType = await getWorkspaceOrgType(defaultUsername);

    expect(orgType).to.equal(OrgType.SourceTracked);
    expect(authInfoCreateStub.getCall(0).args[0]).to.eql({
      username: 'scratch@org.com'
    });

    aliasesStub.restore();
    authInfoCreateStub.restore();
  });

  it('returns the non-source-tracked org type', async () => {
    const defaultUsername = 'sandbox@org.com';
    const aliasesStub = getAliasesFetchStub(undefined);
    const authInfoCreateStub = getAuthInfoCreateStub({
      getFields: () => ({})
    });
    const orgType = await getWorkspaceOrgType(defaultUsername);

    expect(orgType).to.equal(OrgType.NonSourceTracked);
    expect(authInfoCreateStub.getCall(0).args[0]).to.eql({
      username: defaultUsername
    });

    aliasesStub.restore();
    authInfoCreateStub.restore();
  });

  it('throws an error when no defaultusername is set', async () => {
    const aliasesSpy = sinon.spy(Aliases, 'fetch');
    let errorWasThrown = false;
    try {
      await getWorkspaceOrgType(undefined);
    } catch (error) {
      errorWasThrown = true;
      expect(error.name).to.equal('NoDefaultusernameSet');
    } finally {
      expect(aliasesSpy.called).to.be.false;
      expect(errorWasThrown).to.be.true;
      aliasesSpy.restore();
    }
  });

  it('throws an error when the info cannot be found for the defaultusername', async () => {
    const aliasesStub = getAliasesFetchStub('test@org.com');
    const defaultUsername = 'testUsername';
    const error = new Error();
    error.name = 'NamedOrgNotFound';
    const orgAuthInfoStub = sinon
      .stub(OrgAuthInfo, 'isAScratchOrg')
      .throws(error);

    let errorWasThrown = false;
    try {
      await getWorkspaceOrgType(defaultUsername);
    } catch (error) {
      errorWasThrown = true;
      expect(error.name).to.equal('NamedOrgNotFound');
    } finally {
      expect(errorWasThrown).to.be.true;
      aliasesStub.restore();
      orgAuthInfoStub.restore();
    }
  });

  it('throws an error when the cli has no configuration', async () => {
    const aliasesStub = getAliasesFetchStub('test@org.com');
    const defaultUsername = 'testUsername';
    const error = new Error();
    error.name = 'GenericKeychainServiceError';
    error.stack =
      'GenericKeychainServiceError: The service and acount specified in key.json do not match the version of the toolbelt ...';
    const orgAuthInfoStub = sinon
      .stub(OrgAuthInfo, 'isAScratchOrg')
      .throws(error);

    let errorWasThrown = false;
    try {
      await getWorkspaceOrgType(defaultUsername);
    } catch (error) {
      errorWasThrown = true;
      expect(error.name).to.equal('GenericKeychainServiceError');
      expect(error.stack).to.equal(
        'GenericKeychainServiceError: The service and acount specified in key.json do not match the version of the toolbelt ...'
      );
    } finally {
      expect(errorWasThrown).to.be.true;
      aliasesStub.restore();
      orgAuthInfoStub.restore();
    }
  });
});

describe('setWorkspaceOrgTypeWithOrgType', () => {
  let sandbox: sinon.SinonSandbox;
  let executeCommandSpy: sinon.SinonSpy;
  let getConfigurationStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    executeCommandSpy = sandbox.spy(vscode.commands, 'executeCommand');
    getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('verifies a scratch org with enableOrgBrowserAndDeployAndRetrieveForSourceTrackedOrgs setting turned on sets enable_org_browser', async () => {
    getConfigurationStub.returns({
      get: () => {
        return true;
      }
    });

    setWorkspaceOrgTypeWithOrgType(OrgType.SourceTracked);

    expect(executeCommandSpy.callCount).to.equal(3);
    expect(JSON.stringify(executeCommandSpy.firstCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_org_browser',
        true
      ])
    );
    expect(JSON.stringify(executeCommandSpy.secondCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_push_and_pull_commands',
        true
      ])
    );
    expect(JSON.stringify(executeCommandSpy.thirdCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_deploy_and_retrieve_commands',
        true
      ])
    );
  });

  it('verifies a scratch org with enableOrgBrowserAndDeployAndRetrieveForSourceTrackedOrgs setting not turned on dos not set enable_org_browser', async () => {
    getConfigurationStub.returns({
      get: () => {
        return false;
      }
    });

    setWorkspaceOrgTypeWithOrgType(OrgType.SourceTracked);

    expect(executeCommandSpy.callCount).to.equal(3);
    expect(JSON.stringify(executeCommandSpy.firstCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_org_browser',
        false
      ])
    );
    expect(JSON.stringify(executeCommandSpy.secondCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_push_and_pull_commands',
        true
      ])
    );
    expect(JSON.stringify(executeCommandSpy.thirdCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_deploy_and_retrieve_commands',
        false
      ])
    );
  });

  it('verifies a developer org sets enable_org_browser', async () => {
    setWorkspaceOrgTypeWithOrgType(OrgType.NonSourceTracked);

    expect(executeCommandSpy.callCount).to.equal(3);
    expect(JSON.stringify(executeCommandSpy.firstCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_org_browser',
        true
      ])
    );
    expect(JSON.stringify(executeCommandSpy.secondCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_push_and_pull_commands',
        false
      ])
    );
    expect(JSON.stringify(executeCommandSpy.thirdCall.args)).to.equal(
      JSON.stringify([
        'setContext',
        'sfdx:enable_deploy_and_retrieve_commands',
        true
      ])
    );
  });
});

describe('setupWorkspaceOrgType', () => {
  let sandbox: sinon.SinonSandbox;
  let executeCommandSpy: sinon.SinonSpy;
  // let getConfigurationStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    executeCommandSpy = sandbox.spy(vscode.commands, 'executeCommand');
    // getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should validate the commands are false when user is unknown', async () => {
    const aliasesSpy = sinon.spy(Aliases, 'fetch');
    // const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await setupWorkspaceOrgType(undefined);

    expect(aliasesSpy.called).to.be.false;
    expect(executeCommandSpy.callCount).to.equal(4);
    expectHasDefaultUsernameIsSet(false, executeCommandSpy);
    expectEnableOrgBrowserIsSet(false, executeCommandSpy);
    expectPushAndPullCommandsIsSet(false, executeCommandSpy);
    expectEnableDeployAndRetrieveCommandsIsSet(false, executeCommandSpy);

    aliasesSpy.restore();
    // executeCommandSpy.restore();
  });

  it('should validate the commands are true when user is set', async () => {
    const aliasesStub = getAliasesFetchStub('test@org.com');
    const defaultUsername = 'test@org.com';
    const error = new Error();
    error.name = 'NamedOrgNotFound';
    const orgAuthInfoStub = sinon
      .stub(OrgAuthInfo, 'isAScratchOrg')
      .throws(error);
    // const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await setupWorkspaceOrgType(defaultUsername);

    expect(executeCommandSpy.callCount).to.equal(4);
    expectHasDefaultUsernameIsSet(true, executeCommandSpy);
    expectEnableOrgBrowserIsSet(true, executeCommandSpy);
    expectPushAndPullCommandsIsSet(true, executeCommandSpy);
    expectEnableDeployAndRetrieveCommandsIsSet(true, executeCommandSpy);

    aliasesStub.restore();
    orgAuthInfoStub.restore();
    // executeCommandStub.restore();
  });

  it('should validate the org browser and deploy & retrieve are are false when user is set but enableOrgBrowserAndDeployAndRetrieveForSourceTrackedOrgs is false', async () => {
    const aliasesStub = getAliasesFetchStub('scratch@org.com');
    const authInfoCreateStub = getAuthInfoCreateStub({
      getFields: () => ({
        devHubUsername: 'dev@hub.com'
      })
    });
    const defaultUsername = 'scratchOrgAlias';
    // const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    await sfdxCoreSettings.setConfigValue(ENABLE_ORG_BROWSER_AND_DEPLOY_AND_RETRIEVE_FOR_SOURCE_TRACKED_ORGS, false);

    await setupWorkspaceOrgType(defaultUsername);

    expect(authInfoCreateStub.getCall(0).args[0]).to.eql({
      username: 'scratch@org.com'
    });
    expect(executeCommandSpy.callCount).to.equal(4);
    expectHasDefaultUsernameIsSet(true, executeCommandSpy);
    expectEnableOrgBrowserIsSet(false, executeCommandSpy);
    expectPushAndPullCommandsIsSet(true, executeCommandSpy);
    expectEnableDeployAndRetrieveCommandsIsSet(false, executeCommandSpy);

    aliasesStub.restore();
    authInfoCreateStub.restore();
    // executeCommandStub.restore();
  });

  it('should validate push and pull commands are not set when using a developer edition org', async () => {
    const aliasesStub = getAliasesFetchStub(undefined);
    const authInfoCreateStub = getAuthInfoCreateStub({
      getFields: () => ({})
    });
    // const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    const defaultUsername = 'sandbox@org.com';

    await setupWorkspaceOrgType(defaultUsername);

    expect(executeCommandSpy.callCount).to.equal(4);
    expectHasDefaultUsernameIsSet(true, executeCommandSpy);
    expectEnableOrgBrowserIsSet(true, executeCommandSpy);
    expectPushAndPullCommandsIsSet(false, executeCommandSpy);
    expectEnableDeployAndRetrieveCommandsIsSet(true, executeCommandSpy);

    aliasesStub.restore();
    authInfoCreateStub.restore();
    // executeCommandStub.restore();
  });

  it('should set both sfdx:enable_push_and_pull_commands and sfdx:enable_deploy_and_retrieve_commands contexts to true for cli config error', async () => {
    const aliasesSpy = sinon.spy(Aliases, 'fetch');
    // const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    const username = 'test@org.com';

    const error = new Error();
    error.name = 'GenericKeychainServiceError';
    error.stack =
      'GenericKeychainServiceError: The service and account specified in key.json do not match the version of the toolbelt ...';
    const orgAuthInfoStub = sinon
      .stub(OrgAuthInfo, 'isAScratchOrg')
      .throws(error);

    try {
      await setupWorkspaceOrgType(username);

      expect(aliasesSpy.called).to.be.true;
      expect(executeCommandSpy.callCount).to.equal(4);
      expectHasDefaultUsernameIsSet(true, executeCommandSpy);
      expectEnableOrgBrowserIsSet(true, executeCommandSpy);
      expectPushAndPullCommandsIsSet(true, executeCommandSpy);
      expectEnableDeployAndRetrieveCommandsIsSet(true, executeCommandSpy);
    } finally {
      aliasesSpy.restore();
      orgAuthInfoStub.restore();
      // executeCommandStub.restore();
    }
  });
});

const getDefaultUsernameStub = (returnValue: any) =>
  sinon
    .stub(OrgAuthInfo, 'getDefaultUsernameOrAlias')
    .returns(Promise.resolve(returnValue));

const getAliasesFetchStub = (returnValue: any) =>
  sinon.stub(Aliases, 'fetch').returns(Promise.resolve(returnValue));

const getAuthInfoCreateStub = (returnValue: any) =>
  sinon.stub(AuthInfo, 'create').returns(Promise.resolve(returnValue));

const expectHasDefaultUsernameIsSet = (
  hasUsername: boolean,
  executeCommandSpy: sinon.SinonSpy
) => {
  expect(executeCommandSpy.getCall(0).args).to.eql([
    'setContext',
    'sfdx:has_default_username',
    hasUsername
  ]);
};

const expectEnableOrgBrowserIsSet = (
  hasChangeTracking: boolean,
  executeCommandSpy: sinon.SinonSpy
) => {
  expect(executeCommandSpy.getCall(1).args).to.eql([
    'setContext',
    'sfdx:enable_org_browser',
    hasChangeTracking
  ]);
};

const expectPushAndPullCommandsIsSet = (
  hasChangeTracking: boolean,
  executeCommandSpy: sinon.SinonSpy
) => {
  expect(executeCommandSpy.getCall(2).args).to.eql([
    'setContext',
    'sfdx:enable_push_and_pull_commands',
    hasChangeTracking
  ]);
};

const expectEnableDeployAndRetrieveCommandsIsSet = (
  hasNoChangeTracking: boolean,
  executeCommandSpy: sinon.SinonSpy
) => {
  expect(executeCommandSpy.getCall(3).args).to.eql([
    'setContext',
    'sfdx:enable_deploy_and_retrieve_commands',
    hasNoChangeTracking
  ]);
};
