/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* tslint:disable:no-unused-expression */
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { Aliases, AuthInfo } from '@salesforce/core';
import { ForceConfigGet } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  getDefaultUsernameOrAlias,
  getUsername,
  setupWorkspaceOrgType
} from '../../src/context';

describe('getUsername', () => {
  it('should return the username when given a username', async () => {
    const username = 'test@org.com';
    const aliasesStub = getAliasesFetchStub(undefined);
    expect(await getUsername(username)).to.equal(username);
    aliasesStub.restore();
  });

  it('should return the username when given an alias', async () => {
    const username = 'test@org.com';
    const aliasesStub = getAliasesFetchStub(username);
    expect(await getUsername('orgAlias')).to.equal(username);
    aliasesStub.restore();
  });
});

describe('getDefaultUsernameOrAlias', () => {
  it('returns the defaultusername when the username is set', async () => {
    const getConfigStub = getGetConfigStub(new Map());
    expect(await getDefaultUsernameOrAlias()).to.be.undefined;
    getConfigStub.restore();
  });

  it('returns undefined when no defaultusername is set', async () => {
    const username = 'test@org.com';
    const getConfigStub = getGetConfigStub(
      new Map([['defaultusername', username]])
    );
    expect(await getDefaultUsernameOrAlias()).to.equal(username);
    getConfigStub.restore();
  });
});

describe('setupWorkspaceOrgType', () => {
  it('should set both sfdx:default_username_has_change_tracking and sfdx:default_username_has_no_change_tracking contexts to false', async () => {
    const getConfigStub = getGetConfigStub(new Map());
    const aliasesSpy = sinon.spy(Aliases, 'fetch');
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await setupWorkspaceOrgType();

    expect(aliasesSpy.called).to.be.false;
    expect(executeCommandStub.calledTwice).to.be.true;
    expectDefaultUsernameHasChangeTracking(false, executeCommandStub);
    expectDefaultUsernameHasNoChangeTracking(false, executeCommandStub);

    getConfigStub.restore();
    aliasesSpy.restore();
    executeCommandStub.restore();
  });

  it('should set both sfdx:default_username_has_change_tracking and sfdx:default_username_has_no_change_tracking contexts to true', async () => {
    const getConfigStub = getGetConfigStub(
      new Map([['defaultusername', 'testUsername']])
    );
    const aliasesStub = getAliasesFetchStub('test@org.com');

    const error = new Error();
    error.name = 'NamedOrgNotFound';
    const authInfoStub = sinon.stub(AuthInfo, 'create').throws(error);
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await setupWorkspaceOrgType();

    expect(executeCommandStub.calledTwice).to.be.true;
    expectDefaultUsernameHasChangeTracking(true, executeCommandStub);
    expectDefaultUsernameHasNoChangeTracking(true, executeCommandStub);

    getConfigStub.restore();
    aliasesStub.restore();
    authInfoStub.restore();
    executeCommandStub.restore();
  });

  it('should set sfdx:default_username_has_change_tracking to true, and sfdx:default_username_has_no_change_tracking to false', async () => {
    const getConfigStub = getGetConfigStub(
      new Map([['defaultusername', 'scratchOrgAlias']])
    );
    const aliasesStub = getAliasesFetchStub('scratch@org.com');
    const authInfoCreateStub = getAuthInfoCreateStub({
      getFields: () => ({
        devHubUsername: 'dev@hub.com'
      })
    });
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await setupWorkspaceOrgType();

    expect(authInfoCreateStub.getCall(0).args[0]).to.equal('scratch@org.com');
    expect(executeCommandStub.calledTwice).to.be.true;
    expectDefaultUsernameHasChangeTracking(true, executeCommandStub);
    expectDefaultUsernameHasNoChangeTracking(false, executeCommandStub);

    getConfigStub.restore();
    aliasesStub.restore();
    authInfoCreateStub.restore();
    executeCommandStub.restore();
  });

  it('should set sfdx:default_username_has_change_tracking to false, and sfdx:default_username_has_no_change_tracking to true', async () => {
    const getConfigStub = getGetConfigStub(
      new Map([['defaultusername', 'sandbox@org.com']])
    );
    const aliasesStub = getAliasesFetchStub(undefined);
    const authInfoCreateStub = getAuthInfoCreateStub({
      getFields: () => ({})
    });
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await setupWorkspaceOrgType();

    expect(authInfoCreateStub.getCall(0).args[0]).to.equal('sandbox@org.com');
    expect(executeCommandStub.calledTwice).to.be.true;
    expectDefaultUsernameHasChangeTracking(false, executeCommandStub);
    expectDefaultUsernameHasNoChangeTracking(true, executeCommandStub);

    getConfigStub.restore();
    aliasesStub.restore();
    authInfoCreateStub.restore();
    executeCommandStub.restore();
  });
});

const getGetConfigStub = (returnValue: any) =>
  sinon
    .stub(ForceConfigGet.prototype, 'getConfig')
    .returns(Promise.resolve(returnValue));

const getAliasesFetchStub = (returnValue: any) =>
  sinon.stub(Aliases, 'fetch').returns(Promise.resolve(returnValue));

const getAuthInfoCreateStub = (returnValue: any) =>
  sinon.stub(AuthInfo, 'create').returns(Promise.resolve(returnValue));

const expectDefaultUsernameHasChangeTracking = (
  hasChangeTracking: boolean,
  executeCommandStub: sinon.SinonStub
) => {
  expect(executeCommandStub.getCall(0).args).to.eql([
    'setContext',
    'sfdx:default_username_has_change_tracking',
    hasChangeTracking
  ]);
};

const expectDefaultUsernameHasNoChangeTracking = (
  hasNoChangeTracking: boolean,
  executeCommandStub: sinon.SinonStub
) => {
  expect(executeCommandStub.getCall(1).args).to.eql([
    'setContext',
    'sfdx:default_username_has_no_change_tracking',
    hasNoChangeTracking
  ]);
};
