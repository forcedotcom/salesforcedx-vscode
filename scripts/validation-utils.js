#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const logger = require('./logger-util');

const NODE_VERSION = '12.4.0';
const LERNA_VERSION = '3.13.1';

module.exports = {
  checkVSCodeVersion: () => {
    const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
    if (!nextVersion || !nextVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
      logger.error(`You must set environment variable 'SALESFORCEDX_VSCODE_VERSION'.`);
      logger.info(
        `To set: 'export SALESFORCEDX_VSCODE_VERSION=xx.yy.zz'. Where xx.yy.zz is the release number.`
      );
      process.exit(-1);
    }
  },

  checkCircleCiToken: () => {
    if (!process.env['CIRCLECI_TOKEN']) {
      logger.error(`You must set environment variable 'CIRCLECI_TOKEN'.`);
      logger.info(
        `To set: 'export CIRCLECI_TOKEN=token'. This token allows us to pull the artifacts that will be released.`
      );
      process.exit(-1);
    }
  },

  checkCircleCiBuild: () => {
    if (!process.env['CIRCLECI_BUILD']) {
      logger.error(`You must set environment variable 'CIRCLECI_BUILD'.`);
      logger.info(
        `To set: 'export CIRCLECI_BUILD=build_num'. Where build_num contains the artifacts that will be released.`
      );
      process.exit(-1);
    }
  },

  checkEnvironmentVariables: () => {
    logger.header('\nVerifying environment variables have been set.');
    module.exports.checkVSCodeVersion();
    module.exports.checkCircleCiToken();
    module.exports.checkCircleCiBuild();
  },

  checkNodeVersion: () => {
    logger.header('\nVerifying node version ' + NODE_VERSION + ' is installed.');
    const [version, major, minor, patch] = process.version.match(
      /^v(\d+)\.?(\d+)\.?(\*|\d+)$/
    );
    if (
      parseInt(major) != NODE_VERSION.split('.')[0] ||
      parseInt(minor) < NODE_VERSION.split('.')[1]
    ) {
      logger.error(
        'Please update from node version ' +
        process.version +
        ' to ' +
        NODE_VERSION
      );
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

  checkAWSCliInstall: () => {
    logger.header(`\nVerifying AWS CLI is installed for node version ${NODE_VERSION}.`);
    if (!shell.which('aws')) {
      logger.error('The AWS CLI is not installed or could not be found.');
      logger.info(
        `For installation, see https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-mac.html#cliv2-mac-install-gui`
      );
      process.exit(-1);
    }
  },

  checkAWSAccess: () => {
    logger.header('\nVerifying access to AWS bucket.');
    logger.info(
      'If you see any errors in the steps below, either...\n' +
      '1) Your AWS creds need to be setup or 2) You do not have access to the AWS bucket.'
    );
    const awsExitCode = shell.exec(
      'aws s3 ls s3://dfc-data-production/media/vscode/SHA256.md',
      {
        silent: true
      }
    ).code;
    if (awsExitCode !== 0) {
      logger.error(
        'You do not have the s3 command line installed or you do not have access to the aws s3 bucket.'
      );
      process.exit(-1);
    }
  },

  checkSalesforcePublisherAccess: () => {
    logger.header('\nVerifying access to the Salesforce publisher.');
    const publishers = shell
      .exec('vsce ls-publishers', { silent: true })
      .stdout.trim();
    if (!publishers.includes('salesforce')) {
      logger.error('You do not have access to the salesforce publisher id as part of vsce.');
      logger.info(
        'Either the marketplace token is incorrect or your access to our publisher was removed.'
      );
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
  }
};
