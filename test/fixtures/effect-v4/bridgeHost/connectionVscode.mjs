/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import coreFs from '@salesforce/core/fs';
import { URI } from 'vscode-uri';

export const stats = { workspaceWatchers: 0, workspaceDisposed: 0, settingsWatchers: 0, settingsDisposed: 0 };
export const FileType = { File: 1, Directory: 2 };
export const ConfigurationTarget = { Global: 1 };
const disposable = () => ({ dispose() {} });
export const workspace = {
  workspaceFolders: [{ uri: URI.file('/connection-fixture'), name: 'fixture', index: 0 }],
  name: 'fixture',
  getConfiguration: () => ({ get: key => ({ instanceUrl: 'https://fixture.example', accessToken: ' fixture-secret ', apiVersion: '67.0',
    sessionContext: { username: 'fixture-a@example.com', orgId: '00D000000000001', userId: '005000000000001', namespacePrefix: '', isDevHub: false, isScratch: false, isSandbox: false }
  })[key], update: async () => {} }),
  fs: {
    readFile: uri => coreFs.fs.promises.readFile(uri.scheme === 'memfs' ? uri.path : uri.fsPath),
    writeFile: (uri, content) => coreFs.fs.promises.writeFile(uri.scheme === 'memfs' ? uri.path : uri.fsPath, content),
    createDirectory: uri => coreFs.fs.promises.mkdir(uri.scheme === 'memfs' ? uri.path : uri.fsPath, { recursive: true }),
    stat: async () => ({ type: 1, ctime: 0, mtime: 0, size: 0 }), readDirectory: async () => [],
    delete: async () => {}, rename: async () => {}
  },
  createFileSystemWatcher: () => {
    stats.workspaceWatchers++;
    return { onDidCreate: disposable, onDidChange: disposable, onDidDelete: disposable, dispose: () => { stats.workspaceDisposed++; } };
  },
  onDidChangeConfiguration: () => {
    stats.settingsWatchers++;
    return { dispose: () => { stats.settingsDisposed++; } };
  }
};
export const window = { showErrorMessage: async () => undefined };
export const commands = { executeCommand: async () => undefined };
