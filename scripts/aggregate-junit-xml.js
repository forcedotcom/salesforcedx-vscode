#!/usr/bin/env node

/*
 * Asserts JUnit test results were generated for the specified test categories.
 * If any vscode-integration test runs appear to have crashed, then
 * rerun them once. Lastly, aggregate all results into a directory.
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
 * e.g.
 * node aggregate-junit-xml.js -t integration vscode-integration
 * npm run aggregateJUnit -- -t integration vscode-integration
 */

const fs = require('fs-extra');
const path = require('path');
const shell = require('shelljs');

const TEST_TYPE_ARG = '-t';

const categoryToFile = {
  'vscode-integration': 'junit-custom-vscodeIntegrationTests.xml',
  integration: 'junit-custom-integrationTests.xml',
  unit: 'junit-custom-unitTests.xml',
  system: 'junit-custom.xml'
};

const missingResults = {
  'vscode-integration': [],
  integration: [],
  unit: [],
  system: []
};

function getTestCategories() {
  let flags;
  if (process.argv.indexOf(TEST_TYPE_ARG) > -1) {
    flags = new Set(process.argv.slice(process.argv.indexOf(TEST_TYPE_ARG) + 1));
  }
  if (!flags || flags.size === 0) {
    console.log('Checking all test categories.');
    flags = new Set(Object.keys(categoryToFile).map(c => `${c}`));
  }
  return flags;
}

function createAggregateDirectory() {
  const aggregateDir = path.join(process.cwd(), 'junit-aggregate');
  if (!fs.existsSync(aggregateDir)) {
    shell.mkdir(aggregateDir);
  }
}

function getTestDirectory(packagePath) {
  if (fs.statSync(packagePath).isDirectory()) {
    // scan test directory for each package that has one
    const testDir = path.join(packagePath, 'test');
    if (fs.existsSync(testDir) && fs.statSync(testDir).isDirectory()) {
      return testDir;
    }
  }
  return '';
}

function getMissingResults(flags) {
  const packagesDir = path.join(process.cwd(), 'packages');
  for (const packageName of fs.readdirSync(packagesDir)) {
    const packagePath = path.join(packagesDir, packageName);
    const testDir = getTestDirectory(packagePath);
    if (testDir) {
      for (const testEntry of fs.readdirSync(testDir)) {
        if (flags.has(`${testEntry}`)) {
          if (!copyJunitTestResult(packagePath, packageName, testEntry)) {
            if (testEntry === 'vscode-integration') {
              rerunCrashedVSCodeIntegrationTests(packagePath, packageName, testEntry);
            } else {
              missingResults[testEntry].push(packageName);
            }
          }
        }
      }
    }
  }
}

/*
 * If the current test directory is one we want to aggregate, copy the
 * junit results to the aggregate folder.
 *
 * Return true or false if the test result was found.
 */
function copyJunitTestResult(packagePath, packageName, testEntry) {
  const junitFilePath = path.join(packagePath, categoryToFile[testEntry]);
  if (fs.existsSync(junitFilePath)) {
    shell.cp(junitFilePath, path.join(process.cwd(), 'junit-aggregate', `${packageName}-${categoryToFile[testEntry]}`));
    return true;
  }
  return false;
}

/*
 * Rerun vscode test suites that have crashed. The reason for this crash appears
 * to be due to either Windows or Electron. See W-9138899 for more information.
 */
function rerunCrashedVSCodeIntegrationTests(packagePath, packageName, testEntry) {
  console.assert(testEntry === 'vscode-integration');
  console.log(`\nRerunning vscode integration test suite ${packageName} due to crash.`);
  shell.exec(`npm run --prefix ${packagePath} test:vscode-integration`);

  if (!copyJunitTestResult(packagePath, packageName, testEntry)) {
    missingResults[testEntry].push(packageName);
  }
}

function generateMissingMessage(missingResults) {
  let missingMessage;
  for (const [testType, pkgs] of Object.entries(missingResults)) {
    if (pkgs.length > 0) {
      if (!missingMessage) {
        missingMessage = '\nMissing junit results for the following packages:\n';
      }
      missingMessage += `\n* ${testType}:`;
      missingMessage = pkgs.reduce((previous, current) => `${previous}\n\t- ${current}`, missingMessage);
    }
  }
  return missingMessage;
}

function checkMissingMessage(missingMessage) {
  if (missingMessage) {
    missingMessage += '\n\nPossible Issues:\n\n';
    missingMessage += "1) Tests in the expected suite categories haven't run yet (unit, integration, etc.).\n";
    missingMessage +=
      '2) An unexpected test runner or reporter failure while running tests. Sometimes extension activation issues or issues in the tests can silently fail.\n';
    missingMessage += '3) Test run configuration is improperly set up.\n';
    missingMessage += '4) Circular imports.\n';
    console.error(missingMessage);
    process.exit(1);
  }
}

const flags = getTestCategories();
createAggregateDirectory();
getMissingResults(flags);

const missingMessage = generateMissingMessage(missingResults);
checkMissingMessage(missingMessage);
console.log('Finished test check and aggregation.');
