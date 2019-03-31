/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable-next-line:no-var-requires
const testRunner = require('@salesforce/salesforcedx-test-utils-vscode/out/src/testrunner');

// You can directly control Mocha options by uncommenting the following lines
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure({
  ui: 'bdd', // the TDD UI is being used in extension.test.ts (suite, test, etc.)
  useColors: true, // colored output from test results
  retries: 2,
  slow: 0
});

module.exports = testRunner;
