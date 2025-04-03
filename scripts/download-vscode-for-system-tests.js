#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Downloads an instance of VS Code for tests

if (fs.existsSync('.vscode-test')) {
  // Already downloaded the instance of vscode-test
  console.log('Using already downloaded instance in ' + process.cwd() + '/.vscode-test');
} else {
  const vscodeTestUtilPath = path.join('node_modules', 'vscode', 'bin', 'test');
  console.log(`Invoking ${process.cwd()} ${vscodeTestUtilPath} for downloading VS Code`);
  execSync(`node ${vscodeTestUtilPath}`, { stdio: 'inherit' });
}
