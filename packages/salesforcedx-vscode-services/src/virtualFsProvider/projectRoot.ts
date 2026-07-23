/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { fsPrefix } from './constants';

/**
 * Project root for sample/watcher/IndexedDB writes. Reuses open memfs folder path so consumers
 * share one tree and VS Code per-workspace state (Quick Open history) scopes to the host path.
 *
 * CBW boots per-org memfs folders; deriving (vs hardcoded literal) avoids `vscode-web-state-db-<hash>`
 * collisions across orgs in one browser (W-22816308).
 *
 * Falls back to `sampleProjectName` for empty-window (dev, vscode-test-web no-folder) + non-memfs
 * folders (e.g. `file:`).
 */
export const getProjectRoot = (): { nodePath: string; uri: string } => {
  const folder = vscode.workspace.workspaceFolders?.[0];
  // consumers build `${nodePath}/${filename}`; strip trailing slash so `memfs:/dx-project/`
  // can't yield `memfs:/dx-project//sfdx-project.json`.
  const hostPath = folder?.uri.scheme === fsPrefix ? folder.uri.path.replace(/\/+$/, '') : undefined;
  const nodePath = hostPath && hostPath.length > 0 ? hostPath : `/${sampleProjectName}`;
  return { nodePath, uri: `${fsPrefix}:${nodePath}` };
};
