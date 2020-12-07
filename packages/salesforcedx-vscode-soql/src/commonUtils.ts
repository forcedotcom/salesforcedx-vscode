/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from './channel';
import { telemetryService } from './telemetry';

export function getDocumentName(document: vscode.TextDocument): string {
  const documentPath = document.uri.fsPath;
  return path.basename(documentPath) || '';
}

function hasRootWorkspace(ws: typeof vscode.workspace = vscode.workspace) {
  return ws && ws.workspaceFolders && ws.workspaceFolders.length > 0;
}

function getRootWorkspace(): vscode.WorkspaceFolder {
  return hasRootWorkspace()
    ? (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0]
    : ({} as vscode.WorkspaceFolder);
}

export function getRootWorkspacePath(): string {
  return getRootWorkspace().uri ? getRootWorkspace().uri.fsPath : '';
}

export function showError(kind: string, err: string): void {
  vscode.window.showErrorMessage(`${kind}:  ${err}`);
}

export async function trackError(kind: string, err: string): Promise<void> {
  try {
    await telemetryService.sendException(
      `soql_error_${kind.toLocaleLowerCase()}`,
      err
    );
  } catch (err) {
    channelService.appendLine(`soql_error_telemetry:  ${err.toString()}`);
  }
}

export async function showAndTrackError(
  kind: string,
  err: string
): Promise<void> {
  showError(kind, err);
  await trackError(kind, err);
}
