/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommandBuilder } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as sinon from 'sinon';
import childProcess = require('child_process');

describe('Debugger session service', () => {
  let service: SessionService;
  const mockSpawn = require('mock-spawn');

  beforeEach(() => {
    service = new SessionService();
  });

  describe('Helpers', () => {
    it('Should detect an Apex Debugger session ID by key prefix', () => {
      expect(service.isApexDebuggerSessionId('07aFAKE')).to.equal(true);
    });

    it('Should not detect an Apex Debugger session ID by key prefix', () => {
      expect(service.isApexDebuggerSessionId('FAKE')).to.equal(false);
    });
  });
});
