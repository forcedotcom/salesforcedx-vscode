#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const fs = require('fs');
const logger = require('./logger-util');

const NODE_VERSION = '12.4.0';
const LERNA_VERSION = '3.13.1';

module.exports = {
  checkVSCodeVersion: () => {
    const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
    if (!nextVersion || !nextVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
      logger.error(`You must set environment variable 'SALESFORCEDX_VSCODE_VERSION'.`);
      logger.info(`To set: 'export SALESFORCEDX_VSCODE_VERSION=xx.yy.zz'. Where xx.yy.zz is the release number.`);
      process.exit(-1);
    }
  },

  checkEnvironmentVariables: () => {
    logger.header('\nVerifying environment variables have been set.');
    module.exports.checkVSCodeVersion();
  },

  checkNodeVersion: () => {
    logger.header('\nVerifying node version ' + NODE_VERSION + ' is installed.');
    const [version, major, minor, patch] = process.version.match(/^v(\d+)\.?(\d+)\.?(\*|\d+)$/);
    if (parseInt(major) != NODE_VERSION.split('.')[0] || parseInt(minor) < NODE_VERSION.split('.')[1]) {
      logger.error('Please update from node version ' + process.version + ' to ' + NODE_VERSION);
      process.exit(-1);
    }
  },

  checkLernaInstall: () => {
    logger.header(`\nVerifying lerna is installed for node version ${NODE_VERSION}.`);
    if (!shell.which('lerna') || !shell.which('lerna').includes(NODE_VERSION)) {
      logger.info(`Lerna location: ` + shell.which('lerna'));
      logger.info(
        `Lerna is not installed for node version ${NODE_VERSION} - Installing lerna version ${LERNA_VERSION}`
      );
      shell.exec('npm install -g lerna@' + LERNA_VERSION);
    }
  },

  checkVSCEInstall: () => {
    logger.header(`\nVerifying vsce is installed for node version ${NODE_VERSION}.`);
    if (!shell.which('vsce') || !shell.which('vsce').includes(NODE_VERSION)) {
      logger.info('VSCE Location: ' + shell.which('vsce'));
      logger.info(`VSCE not found for node version ${NODE_VERSION} - Installing latest version.`);
      shell.exec('npm install -g vsce');
    }
  },

  checkSalesforcePublisherAccess: () => {
    logger.header('\nVerifying access to the Salesforce publisher.');
    const publishers = shell.exec('vsce ls-publishers', { silent: true }).stdout.trim();
    if (!publishers.includes('salesforce')) {
      logger.error('You do not have access to the salesforce publisher id as part of vsce.');
      logger.info('Either the marketplace token is incorrect or your access to our publisher was removed.');
      process.exit(-1);
    }
  },

  checkBaseBranch: baseBranch => {
    logger.header(`\nVerifying script execution from branch ${baseBranch}.`);
    const currentBranch = shell
      .exec('git rev-parse --abbrev-ref HEAD', {
        silent: true
      })
      .stdout.trim();
    if (currentBranch !== baseBranch) {
      logger.error(
        `You must execute this script in ${baseBranch}. You are currently running the script on branch ${currentBranch}.`
      );
      process.exit(-1);
    }
  },

  checkJorjeDirectory: () => {
    const JORJE_DEV_DIR = process.env['JORJE_DEV_DIR'];
    if (!JORJE_DEV_DIR) {
      logger.error(`You must set environment variable 'JORJE_DEV_DIR'.`);
      logger.info(
        `To set: Add 'export JORJE_DEV_DIR=/path/to/apex-jorje' to your bash profile, where the path is your local Jorje repository.`
      );
      process.exit(-1);
    }

    try {
      if (!fs.statSync(JORJE_DEV_DIR).isDirectory() || !JORJE_DEV_DIR.includes('apex-jorje')) {
        logger.error(
          `JORJE_DEV_DIR environment variable does not direct to apex-jorje: ${JORJE_DEV_DIR}. Check your bash profile.`
        );
        process.exit(-1);
      }
    } catch (error) {
      logger.error(`Apex Jorje source repository not found.`);
      logger.error(`Verify the path of the environment variable JORJE_DEV_DIR: ${JORJE_DEV_DIR}`);
      process.exit(-1);
    }
    return JORJE_DEV_DIR;
  },

  checkSigningAbility: () => {
    const KEYSTORE = process.env['SFDC_KEYSTORE'];
    if (!KEYSTORE) {
      logger.error(`You must set environment variable 'SFDC_KEYSTORE'.`);
      logger.info(
        `To set: Add 'export SFDC_KEYSTORE=/path/to/sfdc.jks' to your bash profile, where the file is the saved keystore to sign the LSP jar.`
      );
      process.exit(-1);
    }
    try {
      if (!fs.statSync(KEYSTORE).isFile() || !KEYSTORE.includes('.jks')) {
        logger.error(
          `SFDC_KEYSTORE environment variable does not point to a .jks file: ${KEYSTORE}. Check your bash profile.`
        );
        process.exit(-1);
      }
    } catch (error) {
      logger.error(`File ${KEYSTORE} not found. Verify the path of the SFDC_KEYSTORE environment variable`);
      logger.info(`Verify the path of the SFDC_KEYSTORE environment variable`);
      process.exit(-1);
    }

    if (!process.env['SFDC_KEYPASS']) {
      logger.error(`You must set environment 'SFDC_KEYPASS'. Refer to LSP FAQ Quip doc for more info.`);
      logger.info(
        `To set: Add 'export SFDC_KEYSTORE=PASS' to your bash profile, where PASS is the passphrase for the keystore.`
      );
      process.exit(-1);
    }
    return {
      SFDC_KEYSTORE: KEYSTORE,
      SFDC_KEYPASS: process.env['SFDC_KEYPASS']
    };
  }
};
