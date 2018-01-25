#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const path = require('path');

// Executes the test, using the top-level packages as the CODE_EXTENSIONS_PATH

shell.exec(
  `cross-env CODE_EXTENSIONS_PATH='${path.join(
    __dirname,
    '..',
    'packages'
  )}' CODE_TESTS_WORKSPACE='${path.join(
    __dirname,
    '..',
    'packages',
    'system-tests',
    'assets',
    'sfdx-simple'
  )}' node ./node_modules/vscode/bin/test`
);
