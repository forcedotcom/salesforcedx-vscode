#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Installs a list of extensions passed on the command line
var version = process.env.CODE_VERSION;

console.log('### install-vsix-dependencies start');
console.log('CODE_VERSION: ' + version);

var isInsiders = version === 'insiders';

const contentOfVscodeTest = fs.readdirSync(`${process.cwd()}/.vscode-test`);
let vscodeDownloadDir = contentOfVscodeTest.find(file => file.startsWith('vscode-'));

console.log('### where is VScode', { vscodeDownloadDir });
const testRunFolder = path.join('.vscode-test', isInsiders ? 'insiders' : vscodeDownloadDir);
const testRunFolderAbsolute = path.join(process.cwd(), testRunFolder);

const downloadPlatform =
  process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32-archive' : 'linux-x64';

const windowsExecutable = path.join(testRunFolderAbsolute, 'bin', 'code');
const darwinExecutable = path.join(
  testRunFolderAbsolute,
  'Visual Studio Code.app',
  'Contents',
  'Resources',
  'app',
  'bin',
  'code'
);

console.log('### darwin executable', {
  testRunFolderAbsolute
});
const linuxExecutable = path.join(testRunFolderAbsolute, 'VSCode-linux-x64', 'bin', 'code');

const extensionsDir = path.join(__dirname, '..', 'packages');

const executable =
  process.platform === 'darwin' ? darwinExecutable : process.platform === 'win32' ? windowsExecutable : linuxExecutable;

if (process.platform === 'linux') {
  // Somehow the code executable doesn't have +x set on the autobuilds -- set it here
  fs.chmodSync(executable, '755');
}

// We always invoke this script with 'node install-vsix-dependencies arg'
// so position2 is where the first argument is
for (let arg = 2; arg < process.argv.length; arg++) {
  const command = `${executable} --extensions-dir ${extensionsDir} --install-extension ${process.argv[arg]}`;
  console.log('### executing: ' + command);
  execSync(command, { stdio: 'inherit' });
}
