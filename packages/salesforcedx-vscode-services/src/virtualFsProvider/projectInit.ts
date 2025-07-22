/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Buffer } from 'node:buffer';
import * as vscode from 'vscode';
import { fsProvider } from './fsTypes';
import { TEMPLATES, metadataDirs } from './templates/templates';

const createRootDirs = (memfs: fsProvider): void => {
  memfs.createDirectory(vscode.Uri.parse('memfs:/force-app'));
  memfs.createDirectory(vscode.Uri.parse('memfs:/force-app/main'));
  memfs.createDirectory(vscode.Uri.parse('memfs:/force-app/main/default'));
};

const createMetadataDirs = (memfs: fsProvider): void => {
  metadataDirs.map(dir => {
    const uri = vscode.Uri.parse(`memfs:/force-app/main/default/${dir}`);
    memfs.createDirectory(uri);
  });
};

const createConfigFiles = (memfs: fsProvider): void => {
  Object.entries(TEMPLATES).forEach(([name, content]) => {
    const uri = vscode.Uri.parse(`memfs:/${name}`);
    memfs.writeFile(uri, Buffer.from(content.join('\n')), {
      create: true,
      overwrite: true
    });
  });
};

const createProjectStructure = (memfs: fsProvider): void => {
  createRootDirs(memfs);
  createMetadataDirs(memfs);
  createConfigFiles(memfs);
  createVSCodeFiles(memfs);
};

const createVSCodeFiles = (memfs: fsProvider): void => {
  // Create .vscode directory and config files
  memfs.createDirectory(vscode.Uri.parse('memfs:/.vscode'));
  memfs.writeFile(vscode.Uri.parse('memfs:/.vscode/settings.json'), Buffer.from(JSON.stringify({}, null, 2)), {
    create: true,
    overwrite: true
  });
  memfs.writeFile(
    vscode.Uri.parse('memfs:/.vscode/tasks.json'),
    Buffer.from(JSON.stringify({ version: '2.0.0', tasks: [] }, null, 2)),
    { create: true, overwrite: true }
  );
  memfs.writeFile(
    vscode.Uri.parse('memfs:/.vscode/launch.json'),
    Buffer.from(JSON.stringify({ version: '0.2.0', configurations: [] }, null, 2)),
    { create: true, overwrite: true }
  );
  memfs.writeFile(vscode.Uri.parse('memfs:/.vscode/mcp.json'), Buffer.from(JSON.stringify({}, null, 2)), {
    create: true,
    overwrite: true
  });
};

export const allFiles = (memfs: fsProvider): void => {
  const sfdxProject = vscode.Uri.parse('memfs:/sfdx-project.json');
  if (!memfs.exists(sfdxProject)) {
    createProjectStructure(memfs);
  } else {
  }
};
