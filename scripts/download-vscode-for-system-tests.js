#!/usr/bin/env node

const shell = require('shelljs');
const path = require('path');

// Downloads an instance of VS Code for tests

if (shell.test('-e', '.vscode-test')) {
  // Already downloaded the instance of vscode-test
  shell.echo(
    'Using already downloaded instance in ' + shell.pwd() + '/.vscode-test'
  );
} else {
  const vscodePath = path.join('.', 'node_modules', 'vscode', 'bin', 'test');
  console.log('vscodePath = ', vscodePath);
  shell.echo(
    'Invoking ' + shell.pwd() + `${vscodePath} for downloading VS Code`
  );
  shell.exec(`node ${vscodePath}`, { silent: false });
}
