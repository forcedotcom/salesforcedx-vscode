/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DEBUGGER_TYPE,
  LIVESHARE_DEBUGGER_TYPE
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import { expect } from 'chai';
import * as vscode from 'vscode';
import { getDebuggerType } from '../src/index';

describe('Extension Setup', () => {
  describe('Custom request', () => {
    it('Should extract underlying debugger type', async () => {
      const session = {
        type: LIVESHARE_DEBUGGER_TYPE,
        customRequest: async (command: string) => {
          return Promise.resolve(DEBUGGER_TYPE);
        }
      };

      const realType = await getDebuggerType(
        (session as any) as vscode.DebugSession
      );

      expect(realType).to.be.equal(DEBUGGER_TYPE);
    });
  });
});
