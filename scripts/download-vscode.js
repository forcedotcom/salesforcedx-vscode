#!/usr/bin/env node

const ncp = require('ncp');
const path = require('path');
const fs = require('fs');
const downloadAndUnzipVSCode = require('@vscode/test-electron').downloadAndUnzipVSCode;
const logger = require('./logger-util');

// Copy vscode to these directories
const extensionDirectories = [
  'salesforcedx-vscode-apex',
  'salesforcedx-vscode-apex-debugger',
  'salesforcedx-vscode-apex-replay-debugger',
  'salesforcedx-vscode-core',
  'salesforcedx-vscode-lightning',
  'salesforcedx-vscode-lwc',
  'salesforcedx-vscode-visualforce'
];

const vscodeVersion = process.env.CODE_VERSION || 'stable';
const USER_DATA = 'user-data';
const VSCODE_TEST = '.vscode-test';
console.log('### download-vscode start');

// Executable path looks something like:
// ~/salesforcedx-vscode/packages/salesforcedx-vscode-lwc/.vscode-test/vscode-1.41.1/Visual Studio Code.app/Contents/MacOS/Electron
downloadAndUnzipVSCode(vscodeVersion)
  .then(executablePath => {
    console.log('### post downloadAndUnzipVSCode');
    logger.debug('Executable Path: ' + executablePath);

    let vscodeIndex = executablePath.indexOf(VSCODE_TEST) + 13;

    // 'vscode-1.41.1'
    let vscodeDirname = executablePath.substring(vscodeIndex, executablePath.indexOf(path.sep, vscodeIndex));

    // '~/salesforcedx-vscode/.vscode-test/vscode-1.41.1/'
    let vscodeFullPath = executablePath.substring(0, vscodeIndex + vscodeDirname.length + 1);

    // '~/salesforcedx-vscode/'
    let vscodeBasePath = path.dirname(path.dirname(vscodeFullPath));

    logger.debug('Directory Name: ' + vscodeDirname);
    logger.debug('Base Path: ' + vscodeBasePath);
    logger.debug('Full Path: ' + vscodeFullPath);

    // If this script is run from an individual package, don't copy it around unnecessarily
    // Example:
    // ~/salesforcedx-vscode/packages/salesforcedx-vscode-lwc> npm run test:vscode-integration
    if (vscodeBasePath.indexOf(path.sep + 'packages' + path.sep) !== -1) {
      console.log('### vscode package install found');
      // Do nothing, vscode is already downloaded and extracted in this package

      const userData = path.join(vscodeBasePath, VSCODE_TEST, USER_DATA);
      // Remove the previously generated user data to ensure we can run the int tests
      fs.rmSync(userData, { recursive: true, force: true });
    } else {
      // For each extension, copy over the vscode binary
      for (let i = 0; i < extensionDirectories.length; i++) {
        try {
          const copyDestination = path.join(
            vscodeBasePath,
            'packages',
            extensionDirectories[i],
            '.vscode-test',
            vscodeDirname
          );
          logger.debug(`Creating Directories:  ${copyDestination}`);
          if (!fs.existsSync(copyDestination)) {
            fs.mkdirSync(copyDestination, { recursive: true });
          }
          logger.debug(`Copying to: ${copyDestination}`);
          ncp(vscodeFullPath, copyDestination, function (err) {
            if (err) {
              return console.error(err);
            }
          });
        } catch (error) {
          logger.error(error);
        }
      }
    }
  })
  .catch(err => {
    logger.error('Failed to download vscode');
    logger.debug(err);
    process.exit(1);
  });
