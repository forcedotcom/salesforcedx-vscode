#!/usr/bin/env node

const shell = require('shelljs');

shell.set('-e');
shell.set('+v');

const currentVersion = require('../packages/salesforcedx-vscode/package.json')
  .version;

console.log('Current Version ===> ', currentVersion);
const [version, major, minor, patch] = currentVersion.match(
  /^(\d+)\.?(\d+)\.?(\*|\d+)$/
);

const bumpMinor = parseInt(minor) + 1;
const nextVersion = `${major}.${bumpMinor}.${patch}`;

shell.env['SALESFORCEDX_VSCODE_VERSION'] = nextVersion;
shell.echo(`${process.env.SALESFORCEDX_VSCODE_VERSION}`);
