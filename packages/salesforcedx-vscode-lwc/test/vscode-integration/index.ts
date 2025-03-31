/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const testRunner = require('@salesforce/salesforcedx-test-utils-vscode/out/src/testrunner');
import { join, normalize } from 'path';
// You can directly control Mocha options by uncommenting the following lines
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure(
  {
    ui: 'bdd', // the TDD UI is being used in extension.test.ts (suite, test, etc.)
    useColors: true, // colored output from test results
    fullTrace: true,
    slow: 0
  },
  normalize(join(__dirname, '..', '..', '..'))
);

module.exports = testRunner;
