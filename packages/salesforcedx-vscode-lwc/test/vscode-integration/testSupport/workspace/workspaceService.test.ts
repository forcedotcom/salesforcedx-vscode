import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { expect } from 'chai';
import * as vscode from 'vscode';
import { workspaceService } from '../../../../src/testSupport/workspace/workspaceService';

describe('Workspace Service Unit Tests', () => {
  let originalWorkspaceType: lspCommon.WorkspaceType;
  let workspaceServiceRegistration: vscode.Disposable;

  beforeEach(() => {
    originalWorkspaceType = workspaceService.getCurrentWorkspaceType();
  });

  afterEach(() => {
    workspaceService.setCurrentWorkspaceType(originalWorkspaceType);
  });

  describe('SFDX workspace', () => {
    beforeEach(() => {
      workspaceServiceRegistration = workspaceService.register(
        {} as any,
        lspCommon.WorkspaceType.SFDX
      );
    });

    afterEach(() => {
      workspaceServiceRegistration.dispose();
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
  });

  describe('Core all workspace', () => {
    beforeEach(() => {
      workspaceServiceRegistration = workspaceService.register(
        {} as any,
        lspCommon.WorkspaceType.CORE_ALL
      );
    });

    afterEach(() => {
      workspaceServiceRegistration.dispose();
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
  });

  describe('Core partial workspace', () => {
    beforeEach(() => {
      workspaceServiceRegistration = workspaceService.register(
        {} as any,
        lspCommon.WorkspaceType.CORE_PARTIAL
      );
    });

    afterEach(() => {
      workspaceServiceRegistration.dispose();
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
  });

  describe('getCurrentWorkspaceTypeForTelemetry', () => {});
});
