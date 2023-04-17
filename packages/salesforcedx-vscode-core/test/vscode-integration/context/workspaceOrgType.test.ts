/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Org } from '@salesforce/core';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { createSandbox } from 'sinon';
import * as vscode from 'vscode';
import {
  OrgType,
  WorkspaceContext,
  workspaceContextUtils
} from '../../../src/context';
import { OrgAuthInfo } from '../../../src/util';
import Sinon = require('sinon');

const sandbox = createSandbox();

const expectSetHasDefaultUsername = (
  hasUsername: boolean,
  executeCommandStub: sinon.SinonStub
) => {
  expect(executeCommandStub.getCall(0).args).to.eql([
    'setContext',
    'sfdx:has_default_username',
    hasUsername
  ]);
};

const expectDefaultUsernameHasChangeTracking = (
  hasChangeTracking: boolean,
  executeCommandStub: sinon.SinonStub
) => {
  expect(executeCommandStub.getCall(1).args).to.eql([
    'setContext',
    'sfdx:default_username_has_change_tracking',
    hasChangeTracking
  ]);
};

const expectDefaultUsernameHasNoChangeTracking = (
  hasNoChangeTracking: boolean,
  executeCommandStub: sinon.SinonStub
) => {
  expect(executeCommandStub.getCall(2).args).to.eql([
    'setContext',
    'sfdx:default_username_has_no_change_tracking',
    hasNoChangeTracking
  ]);
};
const mockWorkspaceContext = { getConnection: () => {} } as any;

describe('workspaceOrgType unit tests', () => {
  const scratchOrgUser = 'scratch@org.com';
  let getUsernameStub: Sinon.SinonStub;
  let orgCreateStub: Sinon.SinonStub;
  let getDefaultUsernameOrAliasStub: Sinon.SinonStub;
  let createStub: Sinon.SinonStub;
  beforeEach(() => {
    getUsernameStub = sandbox.stub(OrgAuthInfo, 'getUsername');
    orgCreateStub = sandbox.stub(Org, 'create');
    getDefaultUsernameOrAliasStub = sandbox.stub(
      OrgAuthInfo,
      'getDefaultUsernameOrAlias'
    );
    createStub = sandbox.stub(AuthInfo, 'create');
    sandbox.stub(WorkspaceContext, 'getInstance').returns(mockWorkspaceContext);
  });

  afterEach(() => {
    sandbox.restore();
  });
  describe('getDefaultUsernameOrAlias', () => {
    it('returns undefined when no defaultusername is set', async () => {
      getDefaultUsernameOrAliasStub.resolves(undefined);
      expect(await workspaceContextUtils.getDefaultUsernameOrAlias()).to.equal(
        undefined
      );
    });

    it('returns the defaultusername when the username is set', async () => {
      const username = 'test@org.com';
      getDefaultUsernameOrAliasStub.resolves(username);
      expect(await workspaceContextUtils.getDefaultUsernameOrAlias()).to.equal(
        username
      );
    });
  });

  describe('getWorkspaceOrgType', () => {
    it('returns the source-tracked org type', async () => {
      getUsernameStub.resolves(scratchOrgUser);
      orgCreateStub.resolves({
        supportsSourceTracking: async () => true
      });

      const orgType = await workspaceContextUtils.getWorkspaceOrgType();

      expect(orgType).to.equal(OrgType.SourceTracked);
      expect(orgCreateStub.calledOnce).to.eql(true);
    });

    it('returns the non-source-tracked org type', async () => {
      const defaultUsername = 'sandbox@org.com';
      getUsernameStub.resolves(defaultUsername);
      orgCreateStub.resolves({
        supportsSourceTracking: async () => false
      });

      const orgType = await workspaceContextUtils.getWorkspaceOrgType();
      expect(orgType).to.equal(OrgType.NonSourceTracked);
      expect(orgCreateStub.calledOnce).to.eql(true);
    });
  });

  describe('setupWorkspaceOrgType', () => {
    afterEach(() => {
      sandbox.restore();
    });
    it('should set both sfdx:default_username_has_change_tracking and sfdx:default_username_has_no_change_tracking contexts to false', async () => {
      const defaultUsername = undefined;
      const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
      orgCreateStub.resolves({
        supportsSourceTracking: async () => false
      });

      await workspaceContextUtils.setupWorkspaceOrgType(defaultUsername);

      expect(executeCommandStub.calledThrice).to.equal(true);
      expectSetHasDefaultUsername(false, executeCommandStub);
      expectDefaultUsernameHasChangeTracking(false, executeCommandStub);
      expectDefaultUsernameHasNoChangeTracking(true, executeCommandStub);

      executeCommandStub.restore();
    });

    it('should set both sfdx:default_username_has_change_tracking and sfdx:default_username_has_no_change_tracking contexts to true', async () => {
      const defaultUsername = 'test@org.com';
      const error = new Error();
      error.name = 'NamedOrgNotFound';
      const orgAuthInfoStub = sinon
        .stub(OrgAuthInfo, 'isAScratchOrg')
        .throws(error);
      const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
      orgCreateStub.resolves({
        supportsSourceTracking: async () => true
      });

      await workspaceContextUtils.setupWorkspaceOrgType(defaultUsername);

      expect(executeCommandStub.calledThrice).to.equal(true);
      expectSetHasDefaultUsername(true, executeCommandStub);
      expectDefaultUsernameHasChangeTracking(true, executeCommandStub);
      expectDefaultUsernameHasNoChangeTracking(false, executeCommandStub);

      orgAuthInfoStub.restore();
      executeCommandStub.restore();
    });

    it('should set sfdx:default_username_has_change_tracking to true, and sfdx:default_username_has_no_change_tracking to false', async () => {
      getUsernameStub.resolves(scratchOrgUser);
      const defaultUsername = 'scratchOrgAlias';
      const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
      orgCreateStub.resolves({
        supportsSourceTracking: async () => true
      });

      await workspaceContextUtils.setupWorkspaceOrgType(defaultUsername);

      expect(orgCreateStub.calledOnce).to.eql(true);
      expect(executeCommandStub.calledThrice).to.equal(true);
      expectSetHasDefaultUsername(true, executeCommandStub);
      expectDefaultUsernameHasChangeTracking(true, executeCommandStub);
      expectDefaultUsernameHasNoChangeTracking(false, executeCommandStub);

      executeCommandStub.restore();
    });

    it('should set sfdx:default_username_has_change_tracking to false, and sfdx:default_username_has_no_change_tracking to true', async () => {
      const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
      const defaultUsername = 'sandbox@org.com';
      orgCreateStub.resolves({
        supportsSourceTracking: async () => false
      });

      await workspaceContextUtils.setupWorkspaceOrgType(defaultUsername);

      expect(executeCommandStub.calledThrice).to.equal(true);
      expectSetHasDefaultUsername(true, executeCommandStub);
      expectDefaultUsernameHasChangeTracking(false, executeCommandStub);
      expectDefaultUsernameHasNoChangeTracking(true, executeCommandStub);

      executeCommandStub.restore();
    });

    it('should set both sfdx:default_username_has_change_tracking and sfdx:default_username_has_no_change_tracking contexts to true for cli config error', async () => {
      const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

      const username = 'test@org.com';

      const error = new Error();
      error.name = 'GenericKeychainServiceError';
      error.stack =
        'GenericKeychainServiceError: The service and acount specified in key.json do not match the version of the toolbelt ...';
      const orgAuthInfoStub = sinon
        .stub(OrgAuthInfo, 'isAScratchOrg')
        .throws(error);

      try {
        await workspaceContextUtils.setupWorkspaceOrgType(username);

        expect(executeCommandStub.calledThrice).to.equal(true);
        expectSetHasDefaultUsername(true, executeCommandStub);
        expectDefaultUsernameHasChangeTracking(true, executeCommandStub);
        expectDefaultUsernameHasNoChangeTracking(true, executeCommandStub);
      } finally {
        executeCommandStub.restore();
        orgAuthInfoStub.restore();
      }
    });
  });
});
