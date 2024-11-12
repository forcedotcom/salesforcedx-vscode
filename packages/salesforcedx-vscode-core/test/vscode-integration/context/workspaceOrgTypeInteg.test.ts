/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Org } from '@salesforce/core-bundle';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { createSandbox } from 'sinon';
import * as Sinon from 'sinon';
import * as vscode from 'vscode';
import { OrgType, WorkspaceContext, workspaceContextUtils } from '../../../src/context';
import * as workspaceUtil from '../../../src/context/workspaceOrgType';
import { OrgAuthInfo } from '../../../src/util';

const sandbox = createSandbox();

const expectSetHasTargetOrg = (hasUsername: boolean, executeCommandStub: sinon.SinonStub) => {
  expect(executeCommandStub.getCall(0).args).to.eql(['setContext', 'sf:has_target_org', hasUsername]);
};

const expectTargetOrgHasChangeTracking = (
  hasChangeTracking: boolean,
  executeCommandStub: sinon.SinonStub,
  argOrder?: number
) => {
  expect(executeCommandStub.getCall(argOrder ?? 1).args).to.eql([
    'setContext',
    'sf:target_org_has_change_tracking',
    hasChangeTracking
  ]);
};

const mockWorkspaceContext = { getConnection: () => {} } as any;

describe('workspaceOrgType', () => {
  const scratchOrgUser = 'scratch@org.com';
  let getUsernameStub: Sinon.SinonStub;
  let orgCreateStub: Sinon.SinonStub;
  let getTargetOrgOrAliasStub: Sinon.SinonStub;
  let createStub: Sinon.SinonStub;
  let workspaceContextGetInstanceStub: Sinon.SinonStub;

  beforeEach(() => {
    getUsernameStub = sandbox.stub(OrgAuthInfo, 'getUsername');
    orgCreateStub = sandbox.stub(Org, 'create');
    getTargetOrgOrAliasStub = sandbox.stub(OrgAuthInfo, 'getTargetOrgOrAlias');
    createStub = sandbox.stub(AuthInfo, 'create');
    workspaceContextGetInstanceStub = sandbox.stub(WorkspaceContext, 'getInstance');
  });

  afterEach(() => {
    sandbox.restore();
  });
  describe('getTargetOrgOrAlias', () => {
    beforeEach(() => {
      workspaceContextGetInstanceStub.returns(mockWorkspaceContext);
    });
    it('returns undefined when no target-org is set', async () => {
      getTargetOrgOrAliasStub.resolves(undefined);
      expect(await workspaceContextUtils.getTargetOrgOrAlias()).to.equal(undefined);
    });

    it('returns the target-org when the username is set', async () => {
      const username = 'test@org.com';
      getTargetOrgOrAliasStub.resolves(username);
      expect(await workspaceContextUtils.getTargetOrgOrAlias()).to.equal(username);
    });
  });

  describe('getWorkspaceOrgType', () => {
    beforeEach(() => {
      workspaceContextGetInstanceStub.returns(mockWorkspaceContext);
    });

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
      const targetOrg = 'sandbox@org.com';
      getUsernameStub.resolves(targetOrg);
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

    it('should set sf:target_org_has_change_tracking context to false when no default org is set', async () => {
      workspaceContextGetInstanceStub.returns(() => {
        throw new Error('no connection found.');
      });
      const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

      await workspaceUtil.setupWorkspaceOrgType();

      expect(executeCommandStub.calledTwice).to.equal(true);
      expectSetHasTargetOrg(false, executeCommandStub);
      expectTargetOrgHasChangeTracking(false, executeCommandStub);

      executeCommandStub.restore();
    });

    describe('setWorkspaceOrgTypeWithOrgType', () => {
      it('should set sf:target_org_has_change_tracking to true when default org is source-tracked', async () => {
        const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

        workspaceContextUtils.setWorkspaceOrgTypeWithOrgType(OrgType.SourceTracked);

        expect(executeCommandStub.calledOnce).to.equal(true);
        expectTargetOrgHasChangeTracking(true, executeCommandStub, 0);

        executeCommandStub.restore();
      });

      it('should set sf:target_org_has_change_tracking to false when the default org is not source-tracked', async () => {
        const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

        workspaceContextUtils.setWorkspaceOrgTypeWithOrgType(OrgType.NonSourceTracked);

        expect(executeCommandStub.calledOnce).to.equal(true);
        expectTargetOrgHasChangeTracking(false, executeCommandStub, 0);

        executeCommandStub.restore();
      });
    });
  });
});
