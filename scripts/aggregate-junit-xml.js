#!/usr/bin/env node

/*
 * Asserts JUnit test results were generated from a test run with the specified
 * test categories and aggregates them into a directory.
 * 
 * 
 * e.g. with the following structure:
 * 
 * packages/salesforcecx-vscode-lwc/test/unit
 * packages/salesforcecx-vscode-lwc/test/vscode-integration
 * 
 * these files will be asserted to exist:
 * 
 * packages/salesforcedx-vscode-lwc/junit-custom-unitTests.xml
 * packages/salesforcedx-vscode-lwc/junit-custom-vscodeIntegrationTests.xml
 * 
 * and then are copied into a top-level directory called junit-aggregate.'
 * 
 * 
 * Valid categories: unit, integration, vscode-integration
 * 
 * By default, all categories will be tested. To only process specific
 * categories, call the script with desired categories separated by a space.
 * 
 * e.g. node aggregate-junit-xml.js integration vscode-integration
 */

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

// process all test categories if none are specified in arguments
let flags = new Set(process.argv.slice(2));
if (flags.size === 0) {
  flags = new Set(Object.keys(categoryToFile).map(c => `--${c}`));
}

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
    // scan test directory for each package that has one
    const testDir = path.join(packagePath, 'test');
    if (fs.existsSync(testDir) && fs.statSync(testDir).isDirectory()) {
      for (const testEntry of fs.readdirSync(testDir)) {
        // if package test directory has a test category that matches the
        // category input, copy the junit results to the aggregate folder
        if (flags.has(`--${testEntry}`)) {
          const junitFilePath = path.join(packagePath, categoryToFile[testEntry]);
          if (fs.existsSync(junitFilePath)) {
            shell.cp(
              junitFilePath,
              path.join(cwd, 'junit-aggregate', `${entry}-${categoryToFile[testEntry]}`)
            );
          } else {
            missingResults[testEntry].push(entry);
          }
        }
      }
    }
  }
}

// report on missing junit output if there is any, and exit with an error.
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
  missingMessage += "1) Tests in the expected suite categories haven't run yet (unit, integration, etc.).\n";
  missingMessage += '2) An unexpected test runner or reporter failure while running tests. Sometimes extension activation issues or issues in the tests can silently fail.\n';
  missingMessage += '3) Test run configuration is improperly set up.\n';
  console.error(missingMessage);
  process.exit(1);
}