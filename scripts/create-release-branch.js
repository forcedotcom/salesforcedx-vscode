#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { checkVSCodeVersion, checkBaseBranch } = require('./validation-utils');
const logger = require('./logger-util');

const RELEASE_TYPE = process.env['RELEASE_TYPE'];

// Check if package publishes (extension via vscode:publish, or npm via publishConfig)
const shouldUpdateVersion = pkgJson => pkgJson.scripts?.['vscode:publish'] || pkgJson.publishConfig;

// Update version only in packages that publish (extensions + npm packages)
const updatePackageVersions = nextVersion => {
  const packagesDir = path.join(__dirname, '..', 'packages');
  const packages = fs.readdirSync(packagesDir).filter(dir => {
    const pkgPath = path.join(packagesDir, dir, 'package.json');
    return fs.existsSync(pkgPath);
  });

  packages.forEach(pkg => {
    const pkgPath = path.join(packagesDir, pkg, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (shouldUpdateVersion(pkgJson)) {
      pkgJson.version = nextVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
      logger.info(`Updated ${pkg} to ${nextVersion}`);
    }
  });
};

function getReleaseVersion() {
  const currentVersion = require('../packages/salesforcedx-vscode/package.json').version;
  let [version, major, minor, patch] = currentVersion.match(/^(\d+)\.?(\d+)\.?(\*|\d+)$/);

  switch (RELEASE_TYPE) {
    case 'major':
      major = parseInt(major) + 1;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor = parseInt(minor) + 1;
      patch = 0;
      break;
    case 'patch':
      patch = parseInt(patch) + 1;
      break;
    case 'beta':
      patch = getBetaVersion();
      break;
  }
  return `${major}.${minor}.${patch}`;
}

function getBetaVersion() {
  //ISO returns UTC for consistency; new betas can be made every minute
  const yearMonthDateHourMin = new Date().toISOString().replace(/\D/g, '').substring(0, 12);
  return yearMonthDateHourMin;
}

function isBetaRelease() {
  return /beta/.exec(`${RELEASE_TYPE}`);
}

process.env['SALESFORCEDX_VSCODE_VERSION'] = getReleaseVersion();
checkVSCodeVersion();

const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
logger.info(`Release version: ${nextVersion}`);
if (!isBetaRelease()) {
  checkBaseBranch('develop');
}

const releaseBranchName = `release/v${nextVersion}`;

// Check if release branch has already been created
const remoteReleaseBranchExists = execSync(`git ls-remote --heads origin ${releaseBranchName}`, {
  encoding: 'utf8'
}).trim();

if (remoteReleaseBranchExists) {
  logger.error(
    `${releaseBranchName} already exists in remote. You might want to verify the value assigned to SALESFORCEDX_VSCODE_VERSION`
  );
  process.exit(-1);
}

// Create the new release branch and switch to it
execSync(`git checkout -b ${releaseBranchName}`);

// git clean but keeping node_modules around
execSync('git clean -xfd -e node_modules');

// Update version in all package.json files
logger.info(`Updating package versions to ${nextVersion}...`);
updatePackageVersions(nextVersion);

// Add all package.json version update changes
execSync(`git add "**/package.json"`);

// Execute an npm install so that we update the package-lock.json file with the new version
// found in the packages for each submodule.
execSync(`npm install --ignore-scripts --package-lock-only --no-audit`);

// Add change to package lockfile that includes version bump
execSync('git add package-lock.json');

// If it is a beta release, add all files
if (isBetaRelease()) {
  execSync('git add .');
}

// Git commit
execSync(`git commit -m "chore: update to version ${nextVersion}"`);

// Merge release branch to develop as soon as it is cut.
// In this way, we can resolve conflicts between main branch and develop branch when merge main back to develop after the release.
// beta versions should not be merged directly to develop, so we don't merge back to main
if (!isBetaRelease()) {
  execSync(`git checkout develop`);
  execSync(`git merge ${releaseBranchName}`);
  execSync(`git push -u origin develop`);
  execSync(`git checkout ${releaseBranchName}`);
  execSync(`git fetch`);
}

// Push new release branch to remote
execSync(`git push -u origin ${releaseBranchName}`);
