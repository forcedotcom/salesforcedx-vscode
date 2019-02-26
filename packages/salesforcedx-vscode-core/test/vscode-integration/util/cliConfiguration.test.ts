/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as shelljs from 'shelljs';
import { assert, SinonStub, stub } from 'sinon';
import { window } from 'vscode';
import { isCLIInstalled, showCLINotInstalledMessage } from '../../../src/util';

describe('SFDX CLI Configuration utility', () => {
  describe('isCLIInstalled', () => {
    let whichStub: SinonStub;

    beforeEach(() => {
      whichStub = stub(shelljs, 'which');
    });

    afterEach(() => {
      whichStub.restore();
    });

    it('Should return false if sfdx cli path is not found', () => {
      whichStub.withArgs('sfdx').returns('');

      const response = isCLIInstalled();
      expect(response).equal(false);
    });

    it('Should return true if sfdx cli path is found', () => {
      whichStub.withArgs('sfdx').returns('Users/some/path/sfdx/cli');

      const response = isCLIInstalled();
      expect(response).equal(true);
    });

    it('Should return false if sfdx cli path query throwns an exception', () => {
      whichStub
        .withArgs('sfdx')
        .throws(new Error('some exception while querying system path'));

      const response = isCLIInstalled();
      expect(response).equal(false);
    });
  });

  describe('showCLINotInstalledMessage', () => {
    let mShowWarning: SinonStub;

    beforeEach(() => {
      mShowWarning = stub(window, 'showWarningMessage').returns(
        Promise.resolve(null)
      );
    });

    afterEach(() => {
      mShowWarning.restore();
    });

    it('Should show cli install info message', async () => {
      showCLINotInstalledMessage();
      assert.calledOnce(mShowWarning);
    });
  });
});
