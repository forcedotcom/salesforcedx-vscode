#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const logger = require('./logger-util');

// Publishes the .vsix that matches the version in package.json

const packageVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const vsix = fs.readdirSync('.').filter(file => file.match(`-${packageVersion}.vsix`));

if (!vsix.length) {
  logger.error('No VSIX found matching the requested version in package.json');
  process.exit(1);
}

const VSCE_PERSONAL_ACCESS_TOKEN = process.env['VSCE_PERSONAL_ACCESS_TOKEN'];
try {
  execSync(
    `vsce publish ${VSCE_PERSONAL_ACCESS_TOKEN ? `--pat ${VSCE_PERSONAL_ACCESS_TOKEN}` : ''} --packagePath ${vsix}`,
    { stdio: 'inherit' }
  );
} catch (error) {
  logger.error(`There was an error while publishing extension ${vsix}`);
  process.exit(1);
}
