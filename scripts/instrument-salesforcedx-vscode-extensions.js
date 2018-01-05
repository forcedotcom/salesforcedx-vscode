#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const path = require('path');

const extensionsToInstrument = [
  'packages/salesforcedx-vscode-apex',
  'packages/salesforcedx-vscode-apex-debugger',
  'packages/salesforcedx-vscode-core',
  'packages/salesforcedx-vscode-lightning',
  'packages/salesforcedx-vscode-visualforce'
];

const folderToInstrument = 'out';

extensionsToInstrument.forEach(extension => {
  const istanbulExecutable = path.join(
    __dirname,
    '..',
    'node_modules',
    '.bin',
    'istanbul'
  );
  const extensionFolderToInstrument = path.join(
    __dirname,
    '..',
    extension,
    folderToInstrument
  );
  const instrumentedFolder = path.join(extension, 'temp-instrumented');
  shell.exec(
    `${istanbulExecutable} instrument ${extensionFolderToInstrument} --complete-copy -o ${instrumentedFolder}`
  );
  shell.rm('-rf', extensionFolderToInstrument);
  shell.mv(instrumentedFolder, extensionFolderToInstrument);
});
