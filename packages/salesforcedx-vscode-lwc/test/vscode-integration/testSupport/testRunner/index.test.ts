/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { assert, SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const notificationService = sfdxCoreExports.notificationService;
const telemetryService = sfdxCoreExports.telemetryService;
import { nls } from '../../../../src/messages';
import { getLwcTestRunnerExecutable } from '../../../../src/testSupport/testRunner';

describe('Test Runner', () => {
  let existsSyncStub: SinonStub;
  let notificationStub: SinonStub;
  let telemetryStub: SinonStub;
  beforeEach(() => {
    existsSyncStub = stub(fs, 'existsSync');
    notificationStub = stub(notificationService, 'showErrorMessage');
    telemetryStub = stub(telemetryService, 'sendException');
  });

  afterEach(() => {
    existsSyncStub.restore();
    notificationStub.restore();
    telemetryStub.restore();
  });

  const root = /^win32/.test(process.platform) ? 'C:\\' : '/var';
  const sfdxProjectPath = path.join(root, 'project', 'mockSfdxProject');

  it('Should return LWC Test Runner Path when LWC Test Runner is installed and not display error message', () => {
    existsSyncStub.returns(true);
    const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(sfdxProjectPath);
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
    assert.calledWith(notificationStub, nls.localize('no_lwc_jest_found_text'));
    assert.calledOnce(telemetryStub);
    assert.calledWith(
      telemetryStub,
      'lwc_test_no_lwc_jest_found',
      nls.localize('no_lwc_jest_found_text')
    );
  });
});
