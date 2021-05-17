/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import {
  MetadataCacheExecutor,
  MetadataCacheResult
} from '../conflict/metadataCacheService';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';

const workspaceChecker = new SfdxWorkspaceChecker();

/**
 * Perform file diff and execute VS Code diff comand to show in UI.
 * It matches the correspondent file in compoennt.
 * @param localFile local file
 * @param remoteComponent remote source component
 * @returns {Promise<void>}
 */
async function diffFile(
  localFile: string,
  remoteComponent: SourceComponent
): Promise<void> {
  const filePart = path.basename(localFile);
  const defaultUsernameorAlias =
    workspaceContext.alias || workspaceContext.username;

  const remoteFilePaths = remoteComponent.walkContent();
  if (remoteComponent.xml) {
    remoteFilePaths.push(remoteComponent.xml);
  }
  for (const filePath of remoteFilePaths) {
    if (filePath.endsWith(filePart)) {
      const remoteUri = vscode.Uri.file(filePath);
      const localUri = vscode.Uri.file(localFile);

      try {
        await vscode.commands.executeCommand(
          'vscode.diff',
          remoteUri,
          localUri,
          nls.localize(
            'force_source_diff_title',
            defaultUsernameorAlias,
            filePart,
            filePart
          )
        );
      } catch (err) {
        notificationService.showErrorMessage(err.message);
        channelService.appendLine(err.message);
        channelService.showChannelOutput();
        telemetryService.sendException(err.name, err.message);
      }
      return;
    }
  }
}

async function handleCacheResults(cache?: MetadataCacheResult): Promise<void> {
  if (cache) {
    if (!cache.selectedIsDirectory && cache.cache.components) {
      // file
      await diffFile(cache.selectedPath, cache.cache.components[0]);
    } else {
      // directory
    }
  } else {
    const message = nls.localize('force_source_diff_remote_not_found');
    notificationService.showErrorMessage(message);
    throw new Error(message);
  }
}

export async function forceSourceDiff(sourceUri?: vscode.Uri) {
  if (!sourceUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'forcesourcemanifest') {
      sourceUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize('force_source_diff_unsupported_type');
      telemetryService.sendException('unsupported_type_on_diff', errorMessage);
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const defaultUsernameorAlias = workspaceContext.username;
  if (defaultUsernameorAlias) {
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
}
