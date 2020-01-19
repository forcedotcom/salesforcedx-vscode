#!/usr/bin/env node
const process = require('process');
const fs = require('fs-extra');
const path = require('path');
const shell = require('shelljs');

const junitFilesToCheck = [
  'junit-custom.xml',
  'junit-custom-unitTests.xml',
  'junit-custom-integrationTests.xml',
  'junit-custom-vscodeIntegrationTests.xml'
];
const currDir = process.cwd();
const packagesDir = path.join(currDir, 'packages');
const dirs = fs.readdirSync(packagesDir).filter(function(file) {
  return fs.statSync(path.join(packagesDir, file)).isDirectory();
});

shell.mkdir(path.join(process.cwd(), 'junit-aggregate'));

dirs.filter(dir => {
  for (const junitFile of junitFilesToCheck) {
    var fullFilePath = path.join(packagesDir, dir, junitFile);
    if (fs.existsSync(fullFilePath)) {
      shell.cp(
        fullFilePath,
        path.join(process.cwd(), `junit-aggregate/${dir}-${junitFile}`)
      );
    }
  }
});
