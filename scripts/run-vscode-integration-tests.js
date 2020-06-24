#!/usr/bin/env node

const path = require('path');
const { runTests } = require('vscode-test');

function main() {
  try {
    const {
      CODE_VERSION,
      CODE_TESTS_PATH,
      CODE_EXTENSIONS_PATH,
      CODE_TESTS_WORKSPACE
    } = process.env;

    const cwd = process.cwd();
    const version = CODE_VERSION;
    const extensionDevelopmentPath = CODE_EXTENSIONS_PATH
      ? CODE_EXTENSIONS_PATH
      : cwd;
    const extensionTestsPath = CODE_TESTS_PATH
      ? CODE_TESTS_PATH
      : path.join(cwd, 'out', 'test', 'vscode-integration');
    const testWorkspace = CODE_TESTS_WORKSPACE;
    const launchArgs = testWorkspace ? [testWorkspace] : undefined;
    runTests({
      version,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs
    });
  } catch (error) {
    console.error('Test run failed with error:', error);
    console.log('Tests exist with error code: 1 when a test fails.');
    process.exit(1);
  }
}

main();
