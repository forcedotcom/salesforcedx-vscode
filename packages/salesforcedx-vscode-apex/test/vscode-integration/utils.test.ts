/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { useApexLibrary } from '../../src/settings';

const sandbox = createSandbox();

describe('Utils', () => {
  afterEach(() => sandbox.restore());

  describe('useApexLibrary', () => {
    let settingStub: SinonStub;

    beforeEach(() => {
      settingStub = sandbox.stub().withArgs('experimental.useApexLibrary');
      sandbox
        .stub(vscode.workspace, 'getConfiguration')
        .withArgs('salesforcedx-vscode-core')
        .returns({
          get: settingStub
        });
    });

    it('should return true if configuration value is true', () => {
      settingStub.returns(true);

      expect(useApexLibrary()).to.equal(true);
    });

    it('should return false if configuration value is false', () => {
      settingStub.returns(false);

      expect(useApexLibrary()).to.equal(false);
    });
  });
});
