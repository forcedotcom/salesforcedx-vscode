#!/usr/bin/env node

const shell = require('shelljs');
const logger = require('./logger-util');

// Publishes the .vsix that matches the version in package.json

const packageVersion = JSON.parse(shell.cat('package.json')).version;
const vsix = shell.ls().filter(file => file.match(`-${packageVersion}.vsix`));

if (!vsix.length) {
  logger.error('No VSIX found matching the requested version in package.json');
  shell.exit(1);
}

const VSCE_PERSONAL_ACCESS_TOKEN = process.env['VSCE_PERSONAL_ACCESS_TOKEN'];
let vscePublish = '';
if (VSCE_PERSONAL_ACCESS_TOKEN) {
  vscePublish = shell.exec(
    `vsce publish --pat ${VSCE_PERSONAL_ACCESS_TOKEN} --packagePath ${vsix}`
  );
} else {
  // Assume that one has already been configured
  vscePublish = shell.exec(`vsce publish --packagePath ${vsix}`);
}

// Check that publishing extension was successful.
if (vscePublish.code !== 0) {
  logger.error(`There was an error while publishing extension on VS Code marketplace ${vsix}`);
  shell.exit(1);
}

const OVSX_PAT = process.env["OVSX_PAT"];
let ovsxPublish = '';
if (OVSX_PAT) {
  ovsxPublish = shell.exec(`npx ovsx publish --packagePath ${vsix} --pat ${OVSX_PAT}`);
} else {
  // Assume that one has already been configured
  ovsxPublish = shell.exec(`npx ovsx publish --packagePath ${vsix}`);
}
if (ovsxPublish.code !== 0) {
  logger.error(`There was an error while publishing extension on Open VSX Registry ${vsix}`);
  shell.exit(1);
}
