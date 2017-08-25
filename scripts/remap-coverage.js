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
const finalCoverageJson = path.join(
  __dirname,
  '..',
  'packages',
  'system-tests',
  'coverage',
  'coverage-mapped.json'
);
const finalCoverageLcov = path.join(
  __dirname,
  '..',
  'packages',
  'system-tests',
  'coverage',
  'lcov.info'
);

shell.exec(
  `${remapIstanbulExecutable} --input ${unMappedCoverage} --output ${finalCoverageJson}`
);
shell.exec(
  `${remapIstanbulExecutable} --input ${unMappedCoverage} --output ${finalCoverageLcov} --type lcovonly`
);
shell.rm(`${unMappedCoverage}`);
shell.mv(`${finalCoverageJson}`, `${unMappedCoverage}`);
