/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { expect } from 'chai';
import { assert, SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import { workspaceService } from '../../../../src/testSupport/workspace/workspaceService';

describe('Workspace Service Unit Tests', () => {
  let originalWorkspaceType: lspCommon.WorkspaceType;
  let executeCommandStub: SinonStub<[string, ...any[]], Thenable<unknown>>;
  beforeEach(() => {
    originalWorkspaceType = workspaceService.getCurrentWorkspaceType();
    executeCommandStub = stub(vscode.commands, 'executeCommand');
  });

  afterEach(() => {
    workspaceService.setCurrentWorkspaceType(originalWorkspaceType);
    executeCommandStub.restore();
  });

  describe('SFDX workspace', () => {
    beforeEach(() => {
      workspaceService.register({} as any, lspCommon.WorkspaceType.SFDX);
    });

    it('isSFDXWorkspace should return true', () => {
      expect(
        workspaceService.isSFDXWorkspace(lspCommon.WorkspaceType.SFDX)
      ).to.equal(true);
    });

    it('isCoreWorkspace should return false', () => {
      expect(
        workspaceService.isCoreWorkspace(lspCommon.WorkspaceType.SFDX)
      ).to.equal(false);
    });

    it('getCurrentWorkspaceType should return correctly', () => {
      expect(workspaceService.getCurrentWorkspaceType()).to.equal(
        lspCommon.WorkspaceType.SFDX
      );
    });

    it('getCurrentWorkspaceTypeForTelemetry should return correctly', () => {
      expect(workspaceService.getCurrentWorkspaceTypeForTelemetry()).to.equal(
        'SFDX'
      );
    });

    it('should set sf:internal_dev to false', () => {
      assert.calledOnce(executeCommandStub);
      assert.calledWith(
        executeCommandStub,
        'setContext',
        'sf:internal_dev',
        false
      );
    });
  });

  describe('Core all workspace', () => {
    beforeEach(() => {
      workspaceService.register({} as any, lspCommon.WorkspaceType.CORE_ALL);
    });

    it('isSFDXWorkspace should return false', () => {
      expect(
        workspaceService.isSFDXWorkspace(lspCommon.WorkspaceType.CORE_ALL)
      ).to.equal(false);
    });

    it('isCoreWorkspace should return true', () => {
      expect(
        workspaceService.isCoreWorkspace(lspCommon.WorkspaceType.CORE_ALL)
      ).to.equal(true);
    });

    it('getCurrentWorkspaceType should return correctly', () => {
      expect(workspaceService.getCurrentWorkspaceType()).to.equal(
        lspCommon.WorkspaceType.CORE_ALL
      );
    });

    it('getCurrentWorkspaceTypeForTelemetry should return correctly', () => {
      expect(workspaceService.getCurrentWorkspaceTypeForTelemetry()).to.equal(
        'CORE_ALL'
      );
    });

    it('should set sf:internal_dev to true', () => {
      assert.calledOnce(executeCommandStub);
      assert.calledWith(
        executeCommandStub,
        'setContext',
        'sf:internal_dev',
        true
      );
    });
  });

  describe('Core partial workspace', () => {
    beforeEach(() => {
      workspaceService.register(
        {} as any,
        lspCommon.WorkspaceType.CORE_PARTIAL
      );
    });

    it('isSFDXWorkspace should return false', () => {
      expect(
        workspaceService.isSFDXWorkspace(lspCommon.WorkspaceType.CORE_PARTIAL)
      ).to.equal(false);
    });

    it('isCoreWorkspace should return true', () => {
      expect(
        workspaceService.isCoreWorkspace(lspCommon.WorkspaceType.CORE_PARTIAL)
      ).to.equal(true);
    });

    it('getCurrentWorkspaceType should return correctly', () => {
      expect(workspaceService.getCurrentWorkspaceType()).to.equal(
        lspCommon.WorkspaceType.CORE_PARTIAL
      );
    });

    it('getCurrentWorkspaceTypeForTelemetry should return correctly', () => {
      expect(workspaceService.getCurrentWorkspaceTypeForTelemetry()).to.equal(
        'CORE_PARTIAL'
      );
    });

    it('should set sf:internal_dev to true', () => {
      assert.calledOnce(executeCommandStub);
      assert.calledWith(
        executeCommandStub,
        'setContext',
        'sf:internal_dev',
        true
      );
    });
  });
});
