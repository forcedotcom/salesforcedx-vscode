#!/usr/bin/env node

const path = require('path');
const { runIntegrationTests } = require('./vscode-integration-testrunner');

const cwd = process.cwd();
runIntegrationTests({
  extensionDevelopmentPath: path.join(__dirname, '..', 'packages'),
  extensionTestsPath: path.join(cwd, 'out', 'test', 'vscode-integration'),
  testWorkspace: path.join(__dirname, '..', 'packages', 'system-tests', 'assets', 'sfdx-simple')
});
