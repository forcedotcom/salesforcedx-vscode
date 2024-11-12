/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { retrieveTestCodeCoverage } from '../../src/settings';

const sandbox = createSandbox();

describe('Settings', () => {
  let settingStub: SinonStub;

  beforeEach(() => {
    settingStub = sandbox.stub();
    sandbox.stub(vscode.workspace, 'getConfiguration').withArgs(SFDX_CORE_CONFIGURATION_NAME).returns({
      get: settingStub
    });
  });

  afterEach(() => sandbox.restore());

  describe('retrieveTestCodeCoverage', () => {
    it('should return true if configuration value is true', () => {
      settingStub.withArgs('retrieve-test-code-coverage').returns(true);

      expect(retrieveTestCodeCoverage()).to.equal(true);
    });

    it('should return false if configuration value is false', () => {
      settingStub.withArgs('retrieve-test-code-coverage').returns(false);

      expect(retrieveTestCodeCoverage()).to.equal(false);
    });
  });
});
