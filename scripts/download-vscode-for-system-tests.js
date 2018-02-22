#!/usr/bin/env node

const shell = require('shelljs');

// Downloads an instance of VS Code for tests

if (shell.test('-e', '.vscode-test')) {
  // Already downloaded the instance of vscode-test
  shell.echo(
    'Using already downloaded instance in ' + shell.pwd() + '/.vscode-test'
  );
} else {
  shell.echo(
    'Invoking ' +
      shell.pwd() +
      '/node_modules/vscode/bin/test for downloading VS Code'
  );
  shell.exec('node ./node_modules/vscode/bin/test', { silent: true });
}
