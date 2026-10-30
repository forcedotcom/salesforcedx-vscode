/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// eslint-disable-next-line no-restricted-imports -- Test-only adapter runs the actual Node/memfs backends; never bundled in an extension.
import type * as FsPromises from 'node:fs/promises';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

const path = (uri: Pick<URI, 'scheme' | 'path' | 'fsPath'>) => (uri.scheme === 'memfs' ? uri.path : uri.fsPath);
/** VS Code filesystem facade over the actual Node/memfs backend; no domain service is mocked. */
export const installVscodeFs = (fs: typeof FsPromises) => {
  vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(uri => fs.readFile(path(uri)));
  vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation((uri, content) => fs.writeFile(path(uri), content));
  vi.spyOn(vscode.workspace.fs, 'createDirectory').mockImplementation(uri =>
    fs.mkdir(path(uri), { recursive: true }).then(() => undefined)
  );
  vi.spyOn(vscode.workspace.fs, 'rename').mockImplementation((source, target) => fs.rename(path(source), path(target)));
  vi.spyOn(vscode.workspace.fs, 'copy').mockImplementation((source, target, options) =>
    fs.cp(path(source), path(target), {
      recursive: true,
      force: options?.overwrite ?? false,
      errorOnExist: true
    })
  );
  vi.spyOn(vscode.workspace.fs, 'delete').mockImplementation((uri, options) =>
    fs.rm(path(uri), { recursive: options?.recursive ?? false })
  );
  vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async uri => {
    const stat = await fs.stat(path(uri));
    return {
      type: stat.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
      ctime: stat.ctimeMs,
      mtime: stat.mtimeMs,
      size: stat.size
    };
  });
  vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async uri => {
    const entries = await fs.readdir(path(uri), { withFileTypes: true });
    return entries.map(entry => [entry.name, entry.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File]);
  });
};
