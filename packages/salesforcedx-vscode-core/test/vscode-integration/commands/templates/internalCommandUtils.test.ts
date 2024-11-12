/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { Uri } from 'vscode';
import { FileInternalPathGatherer, InternalDevWorkspaceChecker } from '../../../../src/commands/templates';
import { SalesforceCoreSettings } from '../../../../src/settings/salesforceCoreSettings';

describe('Internal Command Utilities', () => {
  describe('Internal Workspace Checker', () => {
    let settings: SinonStub;

    beforeEach(() => {
      settings = stub(SalesforceCoreSettings.prototype, 'getInternalDev');
    });

    afterEach(() => {
      settings.restore();
    });

    it('Should always return false', async () => {
      settings.returns(false);
      const internalDevWSChecker = new InternalDevWorkspaceChecker();
      expect(internalDevWSChecker.check()).to.be.eql(false);
    });

    it('Should always return true', async () => {
      settings.returns(true);
      const internalDevWSChecker = new InternalDevWorkspaceChecker();
      expect(internalDevWSChecker.check()).to.be.eql(true);
    });
  });

  describe('File Internal Path Gatherer', () => {
    let existsSyncStub: sinon.SinonStub;
    let lstatSyncStub: sinon.SinonStub;

    beforeEach(() => {
      existsSyncStub = stub(fs, 'existsSync');
      lstatSyncStub = stub(fs, 'lstatSync');
    });

    afterEach(() => {
      existsSyncStub.restore();
      lstatSyncStub.restore();
    });

    it('Should return Continue', async () => {
      existsSyncStub.returns(true);
      const testDir = path.join('path', 'to', 'outside', 'dir');
      lstatSyncStub.returns({
        isDirectory: () => true
      });

      const folderPathGatherer = new FileInternalPathGatherer(Uri.parse(testDir));
      const response = (await folderPathGatherer.gather()) as ContinueResponse<{
        outputdir: string;
      }>;
      expect(response.type).to.equal('CONTINUE');
      expect(response.data.outputdir).contains(testDir);
    });

    it('Should return Cancel if path is not a directory', async () => {
      existsSyncStub.returns(true);
      const testDir = Uri.parse('file:///path/to/outside/dir');
      lstatSyncStub.returns({
        isDirectory: () => false
      });

      const folderPathGatherer = new FileInternalPathGatherer(testDir);
      const response = await folderPathGatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Cancel if path does not exist', async () => {
      existsSyncStub.returns(false);
      const testDir = Uri.parse('file:///path/to/outside/dir');
      lstatSyncStub.returns({
        isDirectory: () => false
      });

      const folderPathGatherer = new FileInternalPathGatherer(testDir);
      const response = await folderPathGatherer.gather();
      expect(response.type).to.equal('CANCEL');
    });
  });
});
