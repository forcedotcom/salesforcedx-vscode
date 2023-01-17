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

describe('Pull and Push', async () => {
  let scratchOrg: ScratchOrg = undefined;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('PullAndPush', false);
    await scratchOrg.setUp();
  });

  step('Pull Source', async () => {
    step('Open vscode (with the extensions already installed) on an existing sfdx project (e.g. dreamhouse)', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Open command palette and run “SFDX: Push Source to Default Scratch Org”', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify pushing the code to the org was successful by opening the org on the browser', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the command execution output is successful by going to the Output view on vscode', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Push Source', async () => {
    step('Open your scratch org and modify a piece of code (e.g. apex class, layout, etc)', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Open vscode (with the extensions already installed) on the sfdx project (e.g. dreamhouse) that was previously pushed to the scratch org', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Open command palette and run “SFDX: View Changes in Default Scratch Org”', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the code modified directly in the org is listed on vscode\'s Output tab.', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Open command palette and run “SFDX: Pull Source from Default Scratch Org”', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the command execution output is successful by going to the Output view on vscode', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the code you modified in the scratch org is now part of you the code in your local', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
