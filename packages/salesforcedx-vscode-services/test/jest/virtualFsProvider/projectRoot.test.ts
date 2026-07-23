/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import { getProjectRoot } from '../../../src/virtualFsProvider/projectRoot';

const vscode = require('vscode');

const setFolders = (uris: string[]): void => {
  vscode.workspace.workspaceFolders = uris.map((u, index) => ({ uri: URI.parse(u), name: `f${index}`, index }));
};

describe('getProjectRoot', () => {
  afterEach(() => {
    vscode.workspace.workspaceFolders = [];
  });

  it('falls back to /dx-project when no workspace folder is open', () => {
    vscode.workspace.workspaceFolders = [];
    expect(getProjectRoot()).toEqual({ nodePath: '/dx-project', uri: 'memfs:/dx-project' });
  });

  it('falls back to /dx-project when workspaceFolders is undefined', () => {
    vscode.workspace.workspaceFolders = undefined;
    expect(getProjectRoot()).toEqual({ nodePath: '/dx-project', uri: 'memfs:/dx-project' });
  });

  it('derives from the host-opened memfs folder (the CBW per-org path)', () => {
    setFolders(['memfs:/org-alpha']);
    expect(getProjectRoot()).toEqual({ nodePath: '/org-alpha', uri: 'memfs:/org-alpha' });
  });

  it('uses only the first folder in a multi-root window', () => {
    setFolders(['memfs:/org-alpha', 'memfs:/org-beta']);
    expect(getProjectRoot().nodePath).toBe('/org-alpha');
  });

  it('strips a trailing slash so consumers never build a double slash', () => {
    setFolders(['memfs:/org-alpha/']);
    expect(getProjectRoot()).toEqual({ nodePath: '/org-alpha', uri: 'memfs:/org-alpha' });
  });

  it('falls back for a non-memfs first folder (e.g. file: scheme)', () => {
    setFolders(['file:///Users/me/project']);
    expect(getProjectRoot()).toEqual({ nodePath: '/dx-project', uri: 'memfs:/dx-project' });
  });

  it('falls back when the memfs folder path is empty/root', () => {
    setFolders(['memfs:/']);
    expect(getProjectRoot()).toEqual({ nodePath: '/dx-project', uri: 'memfs:/dx-project' });
  });
});
