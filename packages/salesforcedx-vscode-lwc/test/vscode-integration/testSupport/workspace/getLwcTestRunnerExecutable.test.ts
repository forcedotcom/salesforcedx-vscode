/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { assert, SinonStub, stub } from 'sinon';
import * as which from 'which';
import { nls } from '../../../../src/messages';
import { telemetryService } from '../../../../src/telemetry';
import {
  getLwcTestRunnerExecutable,
  workspaceService
} from '../../../../src/testSupport/workspace';

describe('getLwcTestRunnerExecutable Unit Tests', () => {
  let existsSyncStub: SinonStub;
  let whichSyncStub: SinonStub;
  let notificationStub: SinonStub;
  let telemetryStub: SinonStub;
  let getCurrentWorkspaceTypeStub: SinonStub;
  beforeEach(() => {
    existsSyncStub = stub(fs, 'existsSync');
    notificationStub = stub(vscode.window, 'showErrorMessage');
    telemetryStub = stub(telemetryService, 'sendException');
    getCurrentWorkspaceTypeStub = stub(
      workspaceService,
      'getCurrentWorkspaceType'
    );
    telemetryStub.returns(Promise.resolve());
  });

  afterEach(() => {
    existsSyncStub.restore();
    notificationStub.restore();
    telemetryStub.restore();
    getCurrentWorkspaceTypeStub.restore();
  });

  const root = /^win32/.test(process.platform) ? 'C:\\' : '/var';
  describe('SFDX Workspace', () => {
    const sfdxProjectPath = path.join(root, 'project', 'mockSfdxProject');
    beforeEach(() => {
      getCurrentWorkspaceTypeStub.returns(lspCommon.WorkspaceType.SFDX);
    });

    it('Should return LWC Test Runner Path when LWC Test Runner is installed and not display error message', () => {
      existsSyncStub.returns(true);
      const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(
        sfdxProjectPath
      );
      expect(lwcTestRunnerExecutable).to.equal(
        path.join(sfdxProjectPath, 'node_modules', '.bin', 'lwc-jest')
      );
      assert.notCalled(notificationStub);
      assert.notCalled(telemetryStub);
    });

    it('Should display error message when LWC Jest Test Runner is not installed', () => {
      existsSyncStub.returns(false);
      getLwcTestRunnerExecutable(sfdxProjectPath);
      assert.calledOnce(notificationStub);
      assert.calledWith(
        notificationStub,
        nls.localize('no_lwc_jest_found_text')
      );
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        'lwc_test_no_lwc_jest_found',
        nls.localize('no_lwc_jest_found_text')
      );
    });
  });

  describe('Internal Dev Workspace', () => {
    const projectPath = path.join(root, 'project', 'mockProject');
    const mockLwcTestRunnerPath = path.join('/bin', 'lwc-test');
    beforeEach(() => {
      getCurrentWorkspaceTypeStub.returns(lspCommon.WorkspaceType.CORE_PARTIAL);
      whichSyncStub = stub(which, 'sync');
      whichSyncStub.returns(mockLwcTestRunnerPath);
    });

    afterEach(() => {
      whichSyncStub.restore();
    });

    it('Should return LWC Test Runner Path when LWC Test Runner is installed and not display error message', () => {
      existsSyncStub.returns(true);
      const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(projectPath);
      expect(lwcTestRunnerExecutable).to.equal(mockLwcTestRunnerPath);
      assert.notCalled(notificationStub);
      assert.notCalled(telemetryStub);
    });

    it('Should display error message when LWC Jest Test Runner is not installed', () => {
      existsSyncStub.returns(false);
      getLwcTestRunnerExecutable(projectPath);
      assert.calledOnce(notificationStub);
      assert.calledWith(
        notificationStub,
        nls.localize('no_lwc_testrunner_found_text')
      );
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        'lwc_test_no_lwc_testrunner_found',
        nls.localize('no_lwc_testrunner_found_text')
      );
    });
  });
});
