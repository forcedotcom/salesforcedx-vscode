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
  `${prettierExecutable} --config .prettierrc --write "docs/**/*.{yml,json,html,css,js,md}"`,
  {
    cwd: path.join(__dirname, '..')
  }
);
