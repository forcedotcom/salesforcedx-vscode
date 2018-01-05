#!/usr/bin/env node

const shell = require('shelljs');

// Publishes the .vsix that matches the version in package.json

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
  shell.exec('node ./node_modules/vscode/bin/test');
}
