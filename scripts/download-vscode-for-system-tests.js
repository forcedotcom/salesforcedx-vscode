#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');

// Downloads an instance of VS Code for tests

if (shell.test('-e', '.vscode-test')) {
  // Already downloaded the instance of vscode-test
  shell.echo('Using already downloaded instance in ' + shell.pwd() + '/.vscode-test');
} else {
  const vscodeTestUtilPath = path.join('node_modules', 'vscode', 'bin', 'test');
  shell.echo(`Invoking ${shell.pwd()} ${vscodeTestUtilPath} for downloading VS Code`);
  shell.exec(`node ${vscodeTestUtilPath}`, { silent: true });
}
