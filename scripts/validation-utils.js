#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const NODE_VERSION = '12.4.0';
const LERNA_VERSION = '3.13.1';

module.exports = {

  checkVSCodeVersion: () => {
    const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
    if (!nextVersion || !nextVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
      console.log(`You must set environment variable 'SALESFORCEDX_VSCODE_VERSION'.`);
      console.log(
        `To set: 'export SALESFORCEDX_VSCODE_VERSION=xx.yy.zz'. Where xx.yy.zz is the release number.`
      );
      process.exit(-1);
    }
  },

  checkCircleCiToken: () => {
    if (!process.env['CIRCLECI_TOKEN']) {
      console.log(`You must set environment variable 'CIRCLECI_TOKEN'.`);
      console.log(
        `To set: 'export CIRCLECI_TOKEN=token'. This token allows us to pull the artifacts that will be released.`
      );
      process.exit(-1);
    }
  },

  checkCircleCiBuild: () => {
    if (!process.env['CIRCLECI_BUILD']) {
      console.log(`You must set environment variable 'CIRCLECI_BUILD'.`);
      console.log(
        `To set: 'export CIRCLECI_BUILD=build_num'. Where build_num contains the artifacts that will be released.`
      );
      process.exit(-1);
    }
  },

  checkEnvironmentVariables: () => {
    console.log('\nVerifying environment variables have been set.');
    module.exports.checkVSCodeVersion();
    module.exports.checkCircleCiToken();
    module.exports.checkCircleCiBuild();
  },

  checkNodeVerion: () => {
    console.log('\nVerifying node version ' + NODE_VERSION + ' is installed.');
    const [version, major, minor, patch] = process.version.match(/^v(\d+)\.?(\d+)\.?(\*|\d+)$/);
    if (parseInt(major) != NODE_VERSION.split('.')[0] || parseInt(minor) < NODE_VERSION.split('.')[1]) {
      console.log('Please update from node version ' + process.version + ' to ' + NODE_VERSION);
      process.exit(-1);
    }
  },

  checkLernaInstall: () => {
    console.log(`\nVerifying lerna is installed for node version ${NODE_VERSION}.`);
    if (!shell.which('lerna') || !shell.which('lerna').includes(NODE_VERSION)) {
      console.log('Lerna not found - Installing lerna version ' + LERNA_VERSION);
      shell.exec('npm install -g lerna@' + LERNA_VERSION);
    }
  },

  checkVSCEInstall: () => {
    console.log(`\nVerifying vsce is installed for node version ${NODE_VERSION}.`);
    if (!shell.which('vsce') || !shell.which('vsce').includes(NODE_VERSION)) {
      console.log('VSCE not found - Installing latest version.')
      shell.exec('npm install -g vsce');
    }
  },

  checkAWSCliInstall: () => {
    console.log(`\nVerifying AWS CLI is installed for node version ${NODE_VERSION}.`);
    if (!shell.which('aws')) {
      shell.exec('pip3 install awscli --upgrade --user');
      if (!shell.which('aws')) {
        console.log('AWS CLI is not installed or could not be found.');
        console.log('This could be a path issue. Example of resolution:');
        console.log('Install happens in: /Users/<user_name>/Library/Python/3.7/lib/...');
        console.log(`Add 'export PATH=~/Library/Python/3.7/bin/:$PATH' to your ~/.bash_profile`);
        console.log(`Run 'source ~/.bash_profile'`);
        console.log(`Verify installation with 'aws --version'`);
        process.exit(-1);
      }
    }
  },

  checkAWSAccess: () => {
    console.log('\nVerifying access to AWS bucket.');
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
    console.log('\nVerifying access to the Salesforce publisher.');
    const publishers = shell
      .exec('vsce ls-publishers', { silent: true })
      .stdout.trim();
    if (!publishers.includes('salesforce')) {
      console.log('You do not have access to the salesforce publisher id as part of vsce.');
      console.log(
        'Either the marketplace token is incorrect or your access to our publisher was removed.'
      );
      process.exit(-1);
    }
  },

  checkBaseBranch: (baseBranch) => {
    console.log(`\nVerifying script execution from branch ${baseBranch}.`);
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
  }
};
