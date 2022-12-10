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

describe('Run Apex Tests', async () => {
  let scratchOrg: ScratchOrg = undefined;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('RunApexTests', false);
    await scratchOrg.setUp();
  });

  step('Run All Tests via Apex Class', async () => {
    step('Open an existing apex test (e.g. BotTest.cls, search for @isTest)', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the "Run All Tests" code lens at the top of the class', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Run Single Test via Apex Class', async () => {
    step('Open an existing apex test (e.g. BotTest.cls)', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the "Run Test" code lens at the top of one of the test methods', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Run Tests via Command Palette', async () => {
    step('Open command palette and run "SFDX: Run Apex Tests"', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Select a Test Class', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Re-run Last Apex Test Class', async () => {
    step('Open an existing apex test and modify it', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Open command palette and run "SFDX: Push Source to Default Scratch Org"', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Once push is successful, open command palette and run "SFDX: Re-Run Last Run Apex Test Class"', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Run all Apex tests via Test Sidebar', async () => {
    step('Open the Test Sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Make sure all Apex tests in the project are listed', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the run tests button on the top right corner of the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are passing are labeled with a green dot on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are failing have a red dot', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Run all Apex Tests on a Class via the Test Sidebar', async () => {
    step('Open the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Make sure all Apex tests in the project are listed', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the run test button that is shown to the right when you hover a test class name on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are passing are labeled with a green dot on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are failing have a red dot', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Run a Single Apex Test via the Test Sidebar', async () => {
    step('Open the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Make sure all Apex tests in the project are listed', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Hover a test name under one of the test class sections and click the run button that is shown to the right of the test name on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are passing are labeled with a green dot on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are failing have a red dot', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});




