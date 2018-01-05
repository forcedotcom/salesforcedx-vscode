#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');

// Installs a list of extensions passed on the command line

const testRunFolder = '.vscode-test';
const testRunFolderAbsolute = path.join(process.cwd(), testRunFolder);

const version = process.env.CODE_VERSION || '*';

const downloadPlatform =
  process.platform === 'darwin'
    ? 'darwin'
    : process.platform === 'win32' ? 'win32-archive' : 'linux-x64';

const windowsExecutable = path.join(testRunFolderAbsolute, 'Code');
const darwinExecutable = path.join(
  testRunFolderAbsolute,
  'Visual Studio Code.app',
  'Contents',
  'Resources',
  'app',
  'bin',
  'code'
);
const linuxExecutable = path.join(
  testRunFolderAbsolute,
  'VSCode-linux-x64',
  'code'
);
if (
  [
    '0.10.1',
    '0.10.2',
    '0.10.3',
    '0.10.4',
    '0.10.5',
    '0.10.6',
    '0.10.7',
    '0.10.8',
    '0.10.9'
  ].indexOf(version) >= 0
) {
  linuxExecutable = path.join(
    testRunFolderAbsolute,
    'VSCode-linux-x64',
    'Code'
  );
}

const extensionsDir = path.join(__dirname, '..', 'packages');

const executable =
  process.platform === 'darwin'
    ? darwinExecutable
    : process.platform === 'win32' ? windowsExecutable : linuxExecutable;

// We always invoke this script with 'node install-vsix-dependencies arg'
// so position2 is where the first argument is
for (let arg = 2; arg < process.argv.length; arg++) {
  shell.exec(
    `'${executable}' --extensions-dir ${extensionsDir} --install-extension ${process
      .argv[arg]}`
  );
}
