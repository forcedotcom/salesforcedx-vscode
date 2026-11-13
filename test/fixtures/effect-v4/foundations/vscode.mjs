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
export const ProgressLocation = { Notification: 15, Window: 10 };
export const StatusBarAlignment = { Left: 1, Right: 2 };
export const ExtensionMode = { Development: 1, Test: 3, Production: 2 };
export const UIKind = { Desktop: 1, Web: 2 };
export const version = '1.129.0';
export const env = {
  appName: 'Code',
  appHost: 'web',
  language: 'en',
  machineId: 'fixture-machine',
  sessionId: 'fixture-session',
  uiKind: UIKind.Web
};
export class EventEmitter {
  listeners = new Set();
  event = listener => { this.listeners.add(listener); return { dispose: () => this.listeners.delete(listener) }; };
  fire = value => { for (const listener of this.listeners) listener(value); };
  dispose = () => this.listeners.clear();
}
export class TabInputText { constructor(uri) { this.uri = uri; } }
export class TabInputTextDiff { constructor(original, modified) { this.original = original; this.modified = modified; } }
export class Position { constructor(line, character) { this.line = line; this.character = character; } }
export class Range { constructor(start, end) { this.start = start; this.end = end; } }
export const DiagnosticSeverity = { Error: 0 };
export const languages = { createDiagnosticCollection: () => ({ delete() {}, set() {}, dispose() {} }) };
export class FileSystemError extends Error {
  static FileNotFound(value) { return new FileSystemError(`File not found: ${value}`); }
  static FileNotADirectory(value) { return new FileSystemError(`Not a directory: ${value}`); }
}
const settings = new Map([
  ['salesforce-web-console.accessToken', ' fixture-secret '],
  ['salesforce-web-console.instanceUrl', ' https://example.com '],
  ['salesforce-web-console.apiVersion', '67.0']
]);
const disposable = () => ({ dispose() {} });
export const workspace = {
  textDocuments: [],
  workspaceFolders: [{ uri: URI.parse('memfs:/fixture'), name: 'fixture', index: 0 }],
  name: 'fixture',
  getConfiguration: section => ({
    get: key => settings.get(`${section}.${key}`),
    inspect: key => settings.has(`${section}.${key}`) ? { key, globalValue: settings.get(`${section}.${key}`) } : undefined,
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
export const commands = { executeCommand: async () => undefined };
export const extensions = { all: [], getExtension: () => undefined, onDidChange: () => ({ dispose() {} }) };
