#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');

// Installs a list of extensions passed on the command line
var version = process.env.CODE_VERSION || '*';
var isInsiders = version === 'insiders';

const testRunFolder = path.join(
  '.vscode-test',
  isInsiders ? 'insiders' : 'stable'
);
const testRunFolderAbsolute = path.join(process.cwd(), testRunFolder);

const downloadPlatform =
  process.platform === 'darwin'
    ? 'darwin'
    : process.platform === 'win32' ? 'win32-archive' : 'linux-x64';

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
const linuxExecutable = path.join(
  testRunFolderAbsolute,
  'VSCode-linux-x64',
  'bin',
  'code'
);

const extensionsDir = path.join(__dirname, '..', 'packages');

const executable =
  process.platform === 'darwin'
    ? darwinExecutable
    : process.platform === 'win32' ? windowsExecutable : linuxExecutable;

if (process.platform === 'linux') {
  // Somehow the code executable doesn't have +x set on the autobuilds -- set it here
  shell.chmod('+x', `${executable}`);
}

// We always invoke this script with 'node install-vsix-dependencies arg'
// so position2 is where the first argument is
for (let arg = 2; arg < process.argv.length; arg++) {
  if (process.platform === 'win32') {
    // Windows Powershell doesn't like the single quotes around the executable
    shell.exec(
      `${executable} --extensions-dir ${extensionsDir} --install-extension ${process
        .argv[arg]}`
    );
  } else {
    shell.exec(
      `'${executable}' --extensions-dir ${extensionsDir} --install-extension ${process
        .argv[arg]}`
    );
  }
}
