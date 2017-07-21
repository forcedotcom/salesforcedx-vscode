#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

/*
 * Assumptions:
 * 0. The script is running locally - it's not optimized for Travis workflow
 *    yet.
 * 1. The script is running in the right branch.
 * 2. The script is running in a clean environment - all changes have been
 *    committed.
 */

// Bootstrap
shell.exec('npm run bootstrap');

// Compile
shell.exec('npm run compile');

// Test
shell.exec('npm run test');

// lerna publish
// --skip-npm to increment the version number in all packages but not publish to npmjs
// This will still make a commit in Git with the tag of the version used
const nextVersion = process.env['VERSION_INCREMENT'];
if (nextVersion) {
  shell.exec(`lerna publish --exact --repo-version ${nextVersion} --skip-npm`);
} else {
  shell.exec('lerna publish --exact --cd-version minor --yes --skip-npm');
}

// Generate the .vsix files
shell.exec(`npm run vscode:package`);

// Generate the SHA256 and append to the file
shell.exec(`npm run vscode:sha256`);

// Push the SHA256 to AWS
shell.exec('aws s3 cp SHA256 s3://dfc-data-production/media/vscode/SHA256');

// Add SHA256 to git
shell.exec(`git add SHA256`);

// Publish to VS Code Marketplace
shell.exec(`npm run vscode:publish`);

// Perform these steps manually for now
// Git commit
// shell.exec(`git commit -m "Updated SHA256"`);
// Push back to GitHub
//shell.exec(`git push`);
