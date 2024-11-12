/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { commands, Disposable, ExtensionContext, Uri, window } from 'vscode';
import { nls } from '../messages';
import { ConflictFile, ConflictNode } from './conflictNode';
import { ConflictView } from './conflictView';
export {
  CommonDirDirectoryDiffer,
  diffFolder,
  diffOneFile,
  DirectoryDiffer,
  DirectoryDiffResults
} from './directoryDiffer';
export {
  MetadataCacheCallback,
  MetadataCacheExecutor,
  MetadataCacheResult,
  MetadataCacheService,
  MetadataContext,
  PathType
} from './metadataCacheService';
export { PersistentStorageService } from './persistentStorageService';
export const conflictView = ConflictView.getInstance();

export const setupConflictView = async (extensionContext: ExtensionContext): Promise<void> => {
  const view = conflictView;
  await view.init(extensionContext);
};

export const registerConflictView = (): Disposable => {
  const viewItems: Disposable[] = [];

  viewItems.push(commands.registerCommand('sf.conflict.diff', (entry: ConflictFile) => conflictDiff(entry)));

  viewItems.push(commands.registerCommand('sf.conflict.open', (entry: ConflictNode) => openResource(entry)));

  return Disposable.from(...viewItems);
};

const conflictDiff = (file: ConflictFile) => {
  const local = Uri.file(path.join(file.localPath, file.localRelPath));
  const remote = Uri.file(path.join(file.remotePath, file.remoteRelPath));

  const title = nls.localize('conflict_detect_diff_title', file.remoteLabel, file.fileName, file.fileName);
  void commands.executeCommand('vscode.diff', remote, local, title);
};

const openResource = (node: ConflictNode): void => {
  const file = node.conflict;
  if (file) {
    const local = Uri.file(path.join(file.localPath, file.localRelPath));
    void window.showTextDocument(local).then(() => {});
  }
};
