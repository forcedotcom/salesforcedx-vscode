#!/usr/bin/env node

const path = require('path');
const { runIntegrationTests } = require('./vscode-integration-testrunner');

const cwd = process.cwd();
runIntegrationTests({
  extensionDevelopmentPath: cwd,
  extensionTestsPath: path.join(cwd, 'out', 'test', 'vscode-integration')
});
