#!/usr/bin/env node
const path = require('path');
const shell = require('shelljs');

// Generate the SHA256 for the .vsix that matches the version in package.json

const packageVersion = JSON.parse(shell.cat('package.json')).version;
const cwd = process.cwd();
const packageName = path.basename(cwd);

const vsixfile = path.join(
  cwd,
  '..',
  '..',
  'extensions',
  `${packageName}-${packageVersion}.vsix`
);
const vsix = shell.ls(vsixfile);

if (!vsix.length) {
  shell.error('No VSIX found matching the requested version in package.json');
  shell.exit(1);
}

if (/win32/.test(process.platform)) {
  shell.exec(`CertUtil -hashfile ${vsix} SHA256`);
} else {
  shell.exec(`shasum -a 256 ${vsix}`);
}
