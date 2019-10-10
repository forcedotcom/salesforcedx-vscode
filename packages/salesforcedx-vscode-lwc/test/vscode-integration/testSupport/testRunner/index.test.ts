/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const notificationService = sfdxCoreExports.notificationService;
import { nls } from '../../../../src/messages';
import { getLwcTestRunnerExecutable } from '../../../../src/testSupport/testRunner';

describe('Test Runner', () => {
  let existsSyncStub: sinon.SinonStub;
  let notificationStub: SinonStub;
  beforeEach(() => {
    existsSyncStub = stub(fs, 'existsSync');
    notificationStub = stub(notificationService, 'showErrorMessage');
  });

  afterEach(() => {
    existsSyncStub.restore();
    notificationStub.restore();
  });

  const root = /^win32/.test(process.platform) ? 'C:\\' : '/var';
  const sfdxProjectPath = path.join(root, 'project', 'mockSfdxProject');

  it('Should return LWC Test Runner Path when LWC Test Runner is installed', () => {
    existsSyncStub.returns(true);
    const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(sfdxProjectPath);
    expect(lwcTestRunnerExecutable).to.equal(
      path.join(sfdxProjectPath, 'node_modules', '.bin', 'lwc-jest')
    );
  });

  it('Should display error message when LWC Test Runner is not installed', () => {
    existsSyncStub.returns(false);
    getLwcTestRunnerExecutable(sfdxProjectPath);
    expect(notificationStub.calledOnce).to.equal(true);
    expect(notificationStub.getCall(0).args[0]).to.equal(
      nls.localize('no_lwc_test_runner_found_text')
    );
  });
});
