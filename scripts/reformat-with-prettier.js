#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');

const prettierExecutable = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  'prettier'
);

shell.exec(
  `${prettierExecutable} --single-quote --write "packages/salesforcedx-*/package.json" "package.json"`,
  {
    cwd: path.join(__dirname, '..')
  }
);
