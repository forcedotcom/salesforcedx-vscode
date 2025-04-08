#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');

const prettierExecutable = path.join(__dirname, '..', 'node_modules', '.bin', 'prettier');

execSync(`${prettierExecutable} --config .prettierrc --write "packages/salesforcedx-*/package.json" "package.json"`, {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit'
});
