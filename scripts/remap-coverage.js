#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const path = require('path');

const remapIstanbulExecutable = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  'remap-istanbul'
);

const unMappedCoverage = path.join(
  __dirname,
  '..',
  'packages',
  'system-tests',
  'coverage',
  'coverage.json'
);
const finalCoverage = path.join(
  __dirname,
  '..',
  'packages',
  'system-tests',
  'coverage',
  'coverage-final.json'
);

shell.exec(
  `${remapIstanbulExecutable} --input ${unMappedCoverage} --output ${finalCoverage}`
);
