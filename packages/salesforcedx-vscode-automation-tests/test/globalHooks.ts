/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Global test hooks that apply to all e2e tests.
 * This file is automatically loaded by Mocha via .mocharc.json configuration.
 */

import { disableBooleanSetting } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';

beforeEach(async function () {
  // Skip test if any previous test in the suite has failed
  // This prevents cascade failures and saves time during test execution
  if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
    this.skip();
  }
});

before(async () => {
  // Disable internal development mode for all tests
  // This ensures consistent behavior across all test environments
  try {
    await disableBooleanSetting('salesforcedx-vscode-core.internal-development');
  } catch (error) {
    // Ignore errors if the setting doesn't exist or can't be set
    console.log('Could not disable internal-development setting:', error);
  }
});
