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

beforeEach(function () {
  // Skip test if any previous test in the suite has failed
  // This prevents cascade failures and saves time during test execution
  if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
    this.skip();
  }
});
