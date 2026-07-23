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
 * Project root for sample/file watcher/IndexedDB writes. Reuses memfs workspace folder path
 * (if open) so all consumers align on the same tree and VS Code's per-workspace state (Quick
 * Open history, etc.) scopes to the host's chosen path.
 *
 * Code Builder Web boots per-org memfs folders; deriving from the workspace (instead of a
 * hardcoded literal) prevents `vscode-web-state-db-<hash>` collisions across orgs in the
 * same browser (W-22816308).
 *
 * Falls back to `sampleProjectName` for empty-window (dev, vscode-test-web no-folder) and
 * non-memfs workspaces (e.g. `file:` folders), preserving prior behavior.
 */
export const getProjectRoot = (): { nodePath: string; uri: string } => {
  const folder = vscode.workspace.workspaceFolders?.[0];
  // consumers concatenate `${nodePath}/${filename}`; strip any trailing slash the host sent so
  // `memfs:/dx-project/` can't yield `memfs:/dx-project//sfdx-project.json`.
  const hostPath = folder?.uri.scheme === fsPrefix ? folder.uri.path.replace(/\/+$/, '') : undefined;
  const nodePath = hostPath && hostPath.length > 0 ? hostPath : `/${sampleProjectName}`;
  return { nodePath, uri: `${fsPrefix}:${nodePath}` };
};
