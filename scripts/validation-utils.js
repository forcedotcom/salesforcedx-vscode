#!/usr/bin/env node

const NODE_VERSION = '12.4.0';
const LERNA_VERSION = '3.13.1';

module.exports = {

  checkEnvironmentVariables: () => {
    console.log('Verifying environment variables have been set.');
    this.checkVSCodeVersion();
    this.checkCircleCiToken();
    this.checkCircleCiBuild();
  },

  checkVSCodeVersion: () => {
    const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
    if (!nextVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
      console.log('You must set env variable SALESFORCEDX_VSCODE_VERSION.');
      process.exit(-1);
    }
  },

  checkCircleCiToken: () => {
    if (!process.env['CIRCLECI_TOKEN']) {
      console.log(
        'You must specify the CircleCI Token (CIRCLECI_TOKEN) that will allow us to get the artifacts that will be released.'
      );
      process.exit(-1);
    }
  },

  checkCircleCiBuild: () => {
    if (!process.env['CIRCLECI_BUILD']) {
      console.log(
        'You must specify the CircleCI Build number (CIRCLECI_BUILD) that contains the artifacts that will be released.'
      );
      process.exit(-1);
    }
  },

  checkNodeVerion: () => {
    console.log('Verifying node version ' + NODE_VERSION + ' is installed.');
    const [version, major, minor, patch] = process.version.match(/^v(\d+)\.?(\d+)\.?(\*|\d+)$/);
    if (parseInt(major) != NODE_VERSION.split('.')[0] || parseInt(minor) < NODE_VERSION.split('.')[1]) {
      console.log('Please update from node version ' + process.version + ' to ' + NODE_VERSION);
      process.exit(-1);
    }
  },

  checkLernaInstall: () => {
    console.log(`Verifying lerna is installed for node version ${NODE_VERSION}`);
    if (!shell.which('lerna') || shell.which('lerna').includes(NODE_VERSION)) {
      shell.exec('npm install -g lerna@' + LERNA_VERSION);
      console.log('Installing lerna version ' + LERNA_VERSION);
    }
  },

  checkVSCEInstall: () => {
    console.log('Verifying vsce is installed for node version ' + NODE_VERSION);
    if (!shell.which('vsce') || !shell.which('vsce').includes(NODE_VERSION)) {
      console.log('Installing latest version of vsce (Visual Studio Code Extensions CLI).')
      shell.exec('npm install -g vsce');
    }
  },

  checkAWSCliInstall: () => {
    console.log('Verifying AWS CLI is installed for node version ' + NODE_VERSION);
    if (!shell.which('aws')) {
      console.log('AWS CLI is not installed or could not be found');
      process.exit(-1);
    }
  },

  checkAWSAccess: () => {
    console.log('Verifying access to AWS bucket.');
    const awsExitCode = shell.exec(
      'aws s3 ls s3://dfc-data-production/media/vscode/SHA256.md',
      {
        silent: true
      }
    ).code;
    if (awsExitCode !== 0) {
      console.log(
        'You do not have the s3 command line installed or you do not have access to the aws s3 bucket.'
      );
      process.exit(-1);
    }
  },

  checkSalesforcePublisherAccess: () => {
    console.log('Verifying access to the Salesforce publisher.');
    const publishers = shell
      .exec('vsce ls-publishers', { silent: true })
      .stdout.trim();
    if (!publishers.includes('salesforce')) {
      console.log(
        'You do not have the vsce command line installed or you do not have access to the salesforce publisher id as part of vsce.'
      );
      process.exit(-1);
    }
  },

  checkBaseBranch: (baseBranch) => {
    const currentBranch = shell
      .exec('git rev-parse --abbrev-ref HEAD', {
        silent: true
      })
      .stdout.trim();
    if (currentBranch !== baseBranch) {
      console.log(
        `You must execute this script in ${baseBranch}. You are currently running the script on branch ${currentBranch}.`
      );
      process.exit(-1);
    }
  },
};
