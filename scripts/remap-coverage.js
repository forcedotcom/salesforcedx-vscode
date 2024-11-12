#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const path = require('path');

const remapIstanbulExecutable = path.join(__dirname, '..', 'node_modules', '.bin', 'remap-istanbul');

const coverageParentFolder = path.join(__dirname, '..', 'packages', 'system-tests', 'coverage');

shell
  .find(coverageParentFolder)
  .filter(file => file.match(/coverage\.json$/))
  .forEach(file => {
    console.log(file);
    const unMappedCoverageFile = file;
    const mappedCoverageFile = path.join(path.dirname(unMappedCoverageFile), 'coverage-final.json');
    const mappedLcovFile = path.join(path.dirname(unMappedCoverageFile), 'lcov.info');
    shell.exec(`${remapIstanbulExecutable} --input ${unMappedCoverageFile} --output ${mappedCoverageFile}`);
    shell.exec(`${remapIstanbulExecutable} --input ${unMappedCoverageFile} --output ${mappedLcovFile} --type lcovonly`);
    shell.rm(`${unMappedCoverageFile}`);
    shell.mv(`${mappedCoverageFile}`, `${unMappedCoverageFile}`);
  });
