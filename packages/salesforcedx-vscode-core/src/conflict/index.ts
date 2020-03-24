/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { ConflictDetector } from './conflictDetectionService';
import { ConflictFile, ConflictNode } from './conflictNode';
import { ConflictView } from './conflictView';
export {
  ConflictDetectionConfig,
  ConflictDetector
} from './conflictDetectionService';
export {
  CommonDirDirectoryDiffer,
  DirectoryDiffer,
  DirectoryDiffResults
} from './directoryDiffer';
export const conflictView = ConflictView.getInstance();
export const conflictDetector = ConflictDetector.getInstance();

export async function setupConflictView(
  extensionContext: vscode.ExtensionContext
): Promise<void> {
  const view = conflictView;
  await view.init(extensionContext);
}

export async function registerConflictView(): Promise<vscode.Disposable> {
  const viewItems: vscode.Disposable[] = [];

  viewItems.push(
    vscode.commands.registerCommand('sfdx.force.conflict.diff', entry =>
      conflictDiff(entry)
    )
  );

  viewItems.push(
    vscode.commands.registerCommand('sfdx.force.conflict.open', entry =>
      openResource(entry)
    )
  );

  return vscode.Disposable.from(...viewItems);
}

function conflictDiff(file: ConflictFile) {
  const local = vscode.Uri.file(path.join(file.localPath, file.relPath));
  const remote = vscode.Uri.file(path.join(file.remotePath, file.relPath));

  const title = nls.localize(
    'conflict_detect_diff_title',
    file.remoteLabel,
    file.fileName,
    file.fileName
  );
  vscode.commands.executeCommand('vscode.diff', remote, local, title);
}

function openResource(node: ConflictNode) {
  const file = node.conflict;
  if (file) {
    const local = vscode.Uri.file(path.join(file.localPath, file.relPath));
    vscode.commands.executeCommand('vscode.open', local);
  }
}
