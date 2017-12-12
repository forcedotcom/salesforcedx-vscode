/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as vscode from 'vscode';
import { TERMINAL_INTEGRATED_ENVS } from '../../src/constants';
import { CLIENT_ID, SFDX_CLIENT_ENV_VAR } from '../../src/constants';

describe('Logging', () => {
  describe('Logging Environment Variable', () => {
    it('Should have correct environment variable name', () => {
      expect(SFDX_CLIENT_ENV_VAR).to.equal('SFDX_SET_CLIENT_IDS');
    });

    it('Should have correct client id', () => {
      expect(CLIENT_ID).to.equal('sfdx-vscode');
    });

    it('Should set the process environment variable after extension starts', async () => {
      expect(process.env[SFDX_CLIENT_ENV_VAR]).to.equal(CLIENT_ID);
    });

    it('Should set environment variables for the integrated terminal in the workspace settings', async () => {
      const config = vscode.workspace.getConfiguration();
      TERMINAL_INTEGRATED_ENVS.forEach(env => {
        const section: { [k: string]: any } = config.get(env)!;
        expect(section).to.have.property(SFDX_CLIENT_ENV_VAR);
        expect(section[SFDX_CLIENT_ENV_VAR]).to.equal(CLIENT_ID);
      });
    });
  });
});
