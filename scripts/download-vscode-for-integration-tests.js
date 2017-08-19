#!/usr/bin/env node

const shell = require('shelljs');

// Publishes the .vsix that matches the version in package.json

if (shell.test('-e', '.vscode-test')) {
  // Already downloaded the instance of vscode-test
} else {
  shell.exec('node ./node_modules/vscode/bin/test');
}
