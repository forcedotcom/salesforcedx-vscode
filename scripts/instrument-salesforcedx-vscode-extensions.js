#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Exit on error
process.on('uncaughtException', err => {
  console.error(err);
  process.exit(1);
});

// Verbose output
process.env.DEBUG = '*';

const extensionsToInstrument = [
  'packages/salesforcedx-vscode-apex',
  'packages/salesforcedx-vscode-apex-debugger',
  'packages/salesforcedx-vscode-core',
  'packages/salesforcedx-vscode-lightning',
  'packages/salesforcedx-vscode-visualforce',
  'packages/salesforcedx-vscode-apex-replay-debugger',
  'packages/salesforcedx-vscode-lwc'
];

const folderToInstrument = 'out';

extensionsToInstrument.forEach(extension => {
  const istanbulExecutable = path.join(__dirname, '..', 'node_modules', '.bin', 'istanbul');
  const extensionFolderToInstrument = path.join(__dirname, '..', extension, folderToInstrument);
  const instrumentedFolder = path.join(extension, 'temp-instrumented');

  execSync(`${istanbulExecutable} instrument ${extensionFolderToInstrument} --complete-copy -o ${instrumentedFolder}`, {
    stdio: 'inherit'
  });

  fs.rmSync(extensionFolderToInstrument, { recursive: true, force: true });
  fs.renameSync(instrumentedFolder, extensionFolderToInstrument);
});
