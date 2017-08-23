/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { DebugClient } from 'vscode-debugadapter-testsupport';

describe('Debugger adapter - integration', () => {
  describe('Session', () => {
    let dc: DebugClient;

    before(async () => {
      dc = new DebugClient('node', './out/src/adapter/apexDebug.js', 'apex');
      // Use dc.start(4711) to debug the adapter during
      // tests (adapter needs to be launched in debug mode separately).
      await dc.start();
    });

    after(() => {
      dc.stop();
    });

    describe('Attach', () => {
      it('Should send initialized response', async () => {
        await dc.initializeRequest();
      });

      it('Should not attach', async () => {
        try {
          await dc.attachRequest({});
          expect.fail('Debugger client should have thrown an error');
          // tslint:disable-next-line:no-empty
        } catch (error) {}
      });
    });
  });
});
