#!/usr/bin/env node
const path = require('path');
const shell = require('shelljs');

const cwd = process.cwd();
const vsixfilesLocation = path.join(cwd, 'extensions');
const vsixes = shell.ls(vsixfilesLocation);

if (!vsixes.length) {
  shell.error('No VSIX files found matching the requested version in package.json');
  shell.exit(1);
}

process.chdir(vsixfilesLocation);
for (let i = 0; i < vsixes.length; i++) {
  const vsix = vsixes[i];
  if (/win32/.test(process.platform)) {
    shell.exec(`CertUtil -hashfile ${vsix} SHA256`);
  } else {
    shell.exec(`shasum -a 256 ${vsix}`);
  }
}
