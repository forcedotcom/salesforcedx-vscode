#!/usr/bin/env node

const path = require('path');
const { runTests } = require('vscode-test');

function main() {
  try {
    const extensionDevelopmentPath = path.join(__dirname, '..', 'packages');
    const testWorkspace = path.join(
      __dirname,
      '..',
      'packages',
      'system-tests',
      'assets',
      'lwc-recipes'
    );
    const extensionTestsPath = path.join(
      cwd,
      'out',
      'test',
      'vscode-integration'
    );
    runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspace]
    });
  } catch (error) {
    console.error('Test run failed with error:', error);
    console.log('Tests exist with error code: 1 when a test fails.');
    process.exit(1);
  }
}

main();
