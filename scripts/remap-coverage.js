#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const remapIstanbulExecutable = path.join(__dirname, '..', 'node_modules', '.bin', 'remap-istanbul');
const coverageParentFolder = path.join(__dirname, '..', 'packages', 'system-tests', 'coverage');

// Find all coverage.json files recursively using functional programming
const findCoverageFiles = dir => {
  const isCoverageFile = file => file.match(/coverage\.json$/);
  const getFullPath = file => path.join(dir, file);

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = getFullPath(entry.name);
    return entry.isDirectory() ? findCoverageFiles(fullPath) : isCoverageFile(entry.name) ? [fullPath] : [];
  });
};

// Process each coverage file
const coverageFiles = findCoverageFiles(coverageParentFolder);
for (const file of coverageFiles) {
  console.log(file);
  const unMappedCoverageFile = file;
  const mappedCoverageFile = path.join(path.dirname(unMappedCoverageFile), 'coverage-final.json');
  const mappedLcovFile = path.join(path.dirname(unMappedCoverageFile), 'lcov.info');

  execSync(`${remapIstanbulExecutable} --input ${unMappedCoverageFile} --output ${mappedCoverageFile}`);
  execSync(`${remapIstanbulExecutable} --input ${unMappedCoverageFile} --output ${mappedLcovFile} --type lcovonly`);

  fs.unlinkSync(unMappedCoverageFile);
  fs.renameSync(mappedCoverageFile, unMappedCoverageFile);
}
