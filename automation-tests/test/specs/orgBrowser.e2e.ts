/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import {
  ScratchOrg
} from '../ScratchOrg';

describe('Org Browser', async () => {
  let scratchOrg: ScratchOrg = undefined;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('OrgBrowser', false);
    await scratchOrg.setUp();
  });

  step('sub-category', async () => {
    step('what?', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('what?', async () => {
    // TODO: implement
    expect(1).toBe(1);
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
