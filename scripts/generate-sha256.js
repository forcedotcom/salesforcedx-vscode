#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const cwd = process.cwd();
const vsixfilesLocation = path.join(cwd, 'extensions');
const vsixes = fs.readdirSync(vsixfilesLocation);

if (!vsixes.length) {
  console.error('No VSIX files found matching the requested version in package.json');
  process.exit(1);
}

process.chdir(vsixfilesLocation);
for (let i = 0; i < vsixes.length; i++) {
  const vsix = vsixes[i];
  try {
    execSync(process.platform === 'win32' ? `CertUtil -hashfile ${vsix} SHA256` : `shasum -a 256 ${vsix}`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(`Error generating SHA256 for ${vsix}:`, error);
    process.exit(1);
  }
}
