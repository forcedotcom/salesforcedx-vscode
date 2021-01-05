#!/usr/bin/env node

const process = require('process');
const fs = require('fs-extra');
const path = require('path');
const shell = require('shelljs');

const cwd = process.cwd();
const packagesDir = path.join(cwd, 'packages');
const aggregateDir = path.join(cwd, 'junit-aggregate');
const categoryToFile = {
  'vscode-integration': 'junit-custom-vscodeIntegrationTests.xml',
  'integration': 'junit-custom-integrationTests.xml',
  'unit': 'junit-custom-unitTests.xml',
  'system': 'junit-custom.xml',
}

let flags = new Set(process.argv.slice(2));
if (flags.size === 0) {
  flags = new Set(Object.keys(categoryToFile));
}

// copy junit results to aggregate folder and identify packages missing test results
if (!fs.existsSync(aggregateDir)) {
  shell.mkdir(path.join(cwd, 'junit-aggregate'));
}

const missingResults = {
  'vscode-integration': [],
  'integration': [],
  'unit': [],
  'system': []
}

for (const entry of fs.readdirSync(packagesDir)) {
  const packagePath = path.join(packagesDir, entry);
  if (fs.statSync(packagePath).isDirectory()) {
    const testDir = path.join(packagePath, 'test');
    if (fs.existsSync(testDir) && fs.statSync(testDir).isDirectory()) {
      for (const testEntry of fs.readdirSync(testDir)) {
        if (flags.has(testEntry)) {
          const junitFilePath = path.join(packagePath, categoryToFile[testEntry]);
          if (fs.existsSync(junitFilePath)) {
            shell.cp(
              junitFilePath,
              path.join(cwd, 'junit-aggregate', `${entry}-${categoryToFile[testEntry]}`)
            );
            foundResults = true;
          } else {
            missingResults[testEntry].push(entry);
          }
        }
      }
    }
  }
}

let missingMessage;

for (const [testType, pkgs] of Object.entries(missingResults)) {
  if (pkgs.length > 0) {
    if (!missingMessage) {
      missingMessage = 'Missing junit results for the following packages:\n';
    }
    missingMessage += `\n* ${testType}:`
    missingMessage = pkgs.reduce((previous, current) => `${previous}\n\t- ${current}`, missingMessage);
  }
}

if (missingMessage) {
  missingMessage += '\n\nPossible Issues:\n\n'
  missingMessage += "1) Tests in the expected suite categories haven't run yet (unit, integration, etc.)\n";
  missingMessage += '2) An unexpected test runner or reporter failure while running tests. Sometimes extension activation issues or issues in the tests can silently fail\n';
  console.error(missingMessage);
  process.exit(1);
}
