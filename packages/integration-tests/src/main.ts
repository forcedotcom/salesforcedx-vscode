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
import * as https from 'https';
import * as path from 'path';

const tempFolder = 'test_data';

// VS CODE BINARY LOCATER
/////////////////////////

const testRunFolder = '.vscode-test';
const testRunFolderAbsolute = path.join(process.cwd(), testRunFolder);

const version = process.env.CODE_VERSION || '*';

const downloadPlatform =
  process.platform === 'darwin'
    ? 'darwin'
    : process.platform === 'win32' ? 'win32-archive' : 'linux-x64';

const darwinExecutable = path.join(
  testRunFolderAbsolute,
  'Visual Studio Code.app',
  'Contents',
  'MacOS',
  'Electron'
);
let linuxExecutable = path.join(
  testRunFolderAbsolute,
  'VSCode-linux-x64',
  'code'
);
const windowsExecutable = path.join(testRunFolderAbsolute, 'Code');

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

process.env.VSCODE_BINARY_PATH =
  process.platform === 'darwin'
    ? darwinExecutable
    : process.platform === 'win32' ? windowsExecutable : linuxExecutable;

// KEYBINDINGS
//////////////

function getKeybindings(location: string): Promise<any> {
  let os = process.platform.toString();
  if (os === 'darwin') {
    os = 'osx';
  } else if (os === 'win32') {
    os = 'win';
  }

  const hostname = 'raw.githubusercontent.com';
  const keybindingsPath = `/Microsoft/vscode-docs/master/scripts/keybindings/doc.keybindings.${os}.json`;

  console.log(`Fetching keybindings from ${path}...`);

  return new Promise((resolve, reject) => {
    https
      .get({ hostname: hostname, path: keybindingsPath }, res => {
        if (res.statusCode !== 200) {
          reject(
            `Failed to obtain key bindings with response code: ${res.statusCode}`
          );
        }

        const buffer: Buffer[] = [];
        res.on('data', chunk => {
          if (chunk instanceof Buffer) {
            buffer.push(chunk);
          } else {
            buffer.push(new Buffer(chunk));
          }
        });
        res.on('end', () => {
          fs.writeFile(location, Buffer.concat(buffer), 'utf8', () => {
            console.log('Keybindings were successfully fetched.');
            resolve();
          });
        });
      })
      .on('error', e => {
        reject(`Failed to obtain key bindings with an error: ${e}`);
      });
  });
}

// SPECTRON MOCHA RUNNER
////////////////////////

function runTests(): void {
  // For normal execution
  const proc = child_process.spawn(process.execPath, [
    path.join('out', 'src', 'mocha-runner.js')
  ]);

  // For debugging purposes
  // 1. Comment out the section "normal execution above"
  // 2. Uncomment the section below
  // 3. Connect using the "Attach to Process for Integration Tests" in VS Code
  // const proc = child_process.spawn(process.execPath, [
  //   '--inspect-brk',
  //   path.join('out', 'src', 'mocha-runner.js')
  // ]);

  proc.stdout.on('data', data => {
    console.log(data.toString());
  });
  proc.stderr.on('data', data => {
    const date = new Date().toLocaleString();
    fs.appendFile(
      `${tempFolder}/errors.log`,
      `${date}: ${data.toString()}`,
      err => {
        if (err) {
          throw new Error(
            `Could not write stderr to errors.log with the following error: ${err}`
          );
        }
      }
    );
  });
  proc.on('exit', code => {
    process.exit(code);
  });
}

// MAIN
///////

function main() {
  const promises: Promise<any>[] = [];
  promises.push(getKeybindings(`${tempFolder}/keybindings.json`));
  Promise.all(promises).then(() => runTests());
}

main();
