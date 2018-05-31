/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Derived from https://github.com/Microsoft/vscode-extension-vscode/blob/master/bin/test
 *
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// VS CODE BINARY LOCATER
/////////////////////////

const version = process.env.CODE_VERSION || '*';
const isInsiders = version === 'insiders';

const testRunFolder = path.join(
  '.vscode-test',
  isInsiders ? 'insiders' : 'stable'
);
const testRunFolderAbsolute = path.join(process.cwd(), testRunFolder);

let windowsExecutable;
let darwinExecutable;
let linuxExecutable;

if (isInsiders) {
  windowsExecutable = path.join(testRunFolderAbsolute, 'Code - Insiders.exe');
  darwinExecutable = path.join(
    testRunFolderAbsolute,
    'Visual Studio Code - Insiders.app',
    'Contents',
    'MacOS',
    'Electron'
  );
  linuxExecutable = path.join(
    testRunFolderAbsolute,
    'VSCode-linux-x64',
    'code-insiders'
  );
} else {
  windowsExecutable = path.join(testRunFolderAbsolute, 'Code.exe');
  darwinExecutable = path.join(
    testRunFolderAbsolute,
    'Visual Studio Code.app',
    'Contents',
    'MacOS',
    'Electron'
  );
  linuxExecutable = path.join(
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
}

const executable =
  process.platform === 'darwin'
    ? darwinExecutable
    : process.platform === 'win32' ? windowsExecutable : linuxExecutable;
process.env.VSCODE_BINARY_PATH = executable;

if (!fs.existsSync(executable) || !fs.statSync(executable).isFile) {
  throw new Error(`VS Code executable not found: ${executable}`);
}

console.log(`Using VS Code executable: ${executable}`);

// SPECTRON MOCHA RUNNER
////////////////////////

function runTests(): void {
  let proc: child_process.ChildProcess;

  if (process.env.DEBUG_SPECTRON) {
    proc = child_process.spawn(
      process.execPath,
      ['--inspect-brk', path.join('out', 'src', 'mocha-runner.js')],
      { stdio: 'inherit' }
    );
  } else {
    proc = child_process.spawn(
      process.execPath,
      [path.join('out', 'src', 'mocha-runner.js')],
      { stdio: 'inherit' }
    );
  }

  proc.on('exit', code => {
    console.log(`[mocha-runner] Mocha Runner exited with code ${code}`);
    process.exit(code);
  });
  proc.on('error', err => {
    console.log(`[mocha-runner] Error running Mocha Runner: ${err}`);
    throw new Error(`Error running Mocha Runner: ${err}`);
  });
}

// MAIN
///////

function main() {
  runTests();
}

main();
