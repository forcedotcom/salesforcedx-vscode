#!/usr/bin/env node

const shell = require('shelljs');

// Publishes the .vsix that matches the version in package.json

const packageVersion = JSON.parse(shell.cat('package.json')).version;
const vsix = shell.ls().filter(file => file.match(`-${packageVersion}.vsix`));

if (!vsix.length) {
  shell.error('No VSIX found matching the requested version in package.json');
  shell.exit(1);
}

const vsce = '../../node_modules/.bin/vsce';
const VSCE_PERSONAL_ACCESS_TOKEN = process.env['VSCE_PERSONAL_ACCESS_TOKEN'];
if (VSCE_PERSONAL_ACCESS_TOKEN) {
  shell.exec(
    `${vsce} publish --pat ${VSCE_PERSONAL_ACCESS_TOKEN} --packagePath ${vsix}`
  );
} else {
  // Assume that one has already been configured
  shell.exec(`${vsce} publish --packagePath ${vsix}`);
}
