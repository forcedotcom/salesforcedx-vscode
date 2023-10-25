/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { channelService } from '../channels';
import {
  MetadataCacheExecutor,
  MetadataCacheResult,
  PathType
} from '../conflict';
import * as differ from '../conflict/directoryDiffer';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceSourceDiff(sourceUri?: vscode.Uri) {
  if (!sourceUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'forcesourcemanifest') {
      sourceUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize('force_source_diff_unsupported_type');
      telemetryService.sendException('unsupported_type_on_diff', errorMessage);
      void notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const defaultUsernameorAlias = WorkspaceContext.getInstance().username;
  if (!defaultUsernameorAlias) {
    void notificationService.showErrorMessage(nls.localize('missing_default_org'));
    return;
  }
  const executor = new MetadataCacheExecutor(
    defaultUsernameorAlias,
    nls.localize('force_source_diff_text'),
    'force_source_diff',
    handleCacheResults
  );
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new FilePathGatherer(sourceUri),
    executor
  );
  await commandlet.run();
}

export async function forceSourceFolderDiff(explorerPath: vscode.Uri) {
  if (!explorerPath) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'forcesourcemanifest') {
      explorerPath = editor.document.uri;
    } else {
      const errorMessage = nls.localize('force_source_diff_unsupported_type');
      telemetryService.sendException('unsupported_type_on_diff', errorMessage);
      void notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const username = WorkspaceContext.getInstance().username;
  if (!username) {
    void notificationService.showErrorMessage(nls.localize('missing_default_org'));
    return;
  }

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(explorerPath),
    new MetadataCacheExecutor(
      username,
      'Source Diff',
      'source-diff-loader',
      handleCacheResults
    )
  );
  await commandlet.run();
}

export async function handleCacheResults(
  username: string,
  cache?: MetadataCacheResult
): Promise<void> {
  if (cache) {
    if (cache.selectedType === PathType.Individual && cache.cache.components) {
      await differ.diffOneFile(
        cache.selectedPath,
        cache.cache.components[0],
        username
      );
    } else if (cache.selectedType === PathType.Folder) {
      differ.diffFolder(cache, username);
    }
  } else {
    const message = nls.localize('force_source_diff_components_not_in_org');
    void notificationService.showErrorMessage(message);
    throw new Error(message);
  }
}
