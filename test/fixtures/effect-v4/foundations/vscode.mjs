/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { URI } from 'vscode-uri';

export const stats = { workspaceWatchers: 0, workspaceDisposed: 0, settingsWatchers: 0, settingsDisposed: 0 };
export const FileType = { File: 1, Directory: 2 };
export const ConfigurationTarget = { Global: 1 };
const settings = new Map([
  ['salesforce-web-console.accessToken', ' fixture-secret '],
  ['salesforce-web-console.instanceUrl', ' https://example.com '],
  ['salesforce-web-console.apiVersion', '67.0']
]);
const disposable = () => ({ dispose() {} });
export const workspace = {
  workspaceFolders: [{ uri: URI.parse('memfs:/fixture'), name: 'fixture', index: 0 }],
  name: 'fixture',
  getConfiguration: section => ({
    get: key => settings.get(`${section}.${key}`),
    update: async (key, value) => {
      settings.set(`${section}.${key}`, value);
    }
  }),
  fs: {
    readFile: async () => new TextEncoder().encode('{"orgs":{"fixture-alias":"user@example.com"}}'),
    writeFile: async () => {},
    createDirectory: async () => {},
    stat: async () => ({ type: FileType.File, ctime: 0, mtime: 0, size: 0 }),
    readDirectory: async () => [],
    delete: async () => {},
    rename: async () => {}
  },
  findFiles: async () => [URI.parse('memfs:/fixture/desktop-result.cls')],
  createFileSystemWatcher: () => {
    stats.workspaceWatchers++;
    return {
      onDidCreate: disposable,
      onDidChange: disposable,
      onDidDelete: disposable,
      dispose: () => {
        stats.workspaceDisposed++;
      }
    };
  },
  onDidChangeConfiguration: () => {
    stats.settingsWatchers++;
    return {
      dispose: () => {
        stats.settingsDisposed++;
      }
    };
  }
};
export const window = { showTextDocument: async () => ({}) };
