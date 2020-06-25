#!/usr/bin/env node
const { runTests } = require('vscode-test');

/**
 * A wrapper utlity for running VS Code integration tests. If a correspondent env variable is specified,
 * it will override the parameters passed in.
 * @param {string} version Version of VS Code to run the tests against
 * @param {string} extensionDevelopmentPath Location of the extensions to load
 * @param {string} extensionTestsPath Location of the tests to execute
 * @param {string} testWorkspace Location of a workspace to open for the test instance
 */
function runIntegrationTests({
  version,
  extensionDevelopmentPath,
  extensionTestsPath,
  testWorkspace
}) {
  try {
    const {
      CODE_VERSION,
      CODE_TESTS_PATH,
      CODE_EXTENSIONS_PATH,
      CODE_TESTS_WORKSPACE
    } = process.env;

    const _version = CODE_VERSION ? CODE_VERSION : version;
    console.log(JSON.stringify(_version, null, 2));
    const _extensionDevelopmentPath = CODE_EXTENSIONS_PATH
      ? CODE_EXTENSIONS_PATH
      : extensionDevelopmentPath;
    const _extensionTestsPath = CODE_TESTS_PATH
      ? CODE_TESTS_PATH
      : extensionTestsPath;
    const _testWorkspace = CODE_TESTS_WORKSPACE
      ? CODE_TESTS_WORKSPACE
      : testWorkspace;
    const launchArgs = _testWorkspace ? [_testWorkspace] : undefined;
    runTests({
      version: _version,
      extensionDevelopmentPath: _extensionDevelopmentPath,
      extensionTestsPath: _extensionTestsPath,
      launchArgs
    });
  } catch (error) {
    console.error('Test run failed with error:', error);
    console.log('Tests exist with error code: 1 when a test fails.');
    process.exit(1);
  }
}

module.exports = {
  runIntegrationTests
};
