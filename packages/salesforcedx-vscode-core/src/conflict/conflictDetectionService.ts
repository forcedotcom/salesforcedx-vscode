/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import {
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  SimpleGatherer
} from '../commands/util';
import { conflictView } from '../conflict';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import {
  CommonDirDirectoryDiffer,
  DirectoryDiffer,
  DirectoryDiffResults,
  TimestampFileProperties
} from './directoryDiffer';
import {
  MetadataCacheCallback,
  MetadataCacheExecutor,
  MetadataCacheResult
} from './metadataCacheService';

export interface ConflictDetectionConfig {
  username: string;
  manifest: string;
}

export class ConflictDetector {
  private differ: DirectoryDiffer;
  private diffs: DirectoryDiffResults;
  private error?: Error;
  private static instance: ConflictDetector;
  private static EMPTY_DIFFS = {
    localRoot: '',
    remoteRoot: '',
    different: new Set<TimestampFileProperties>(),
    scannedLocal: 0,
    scannedRemote: 0
  };

  constructor(differ?: DirectoryDiffer) {
    this.differ = differ || new CommonDirDirectoryDiffer();
    this.diffs = Object.assign({}, ConflictDetector.EMPTY_DIFFS);
  }

  public static getInstance(): ConflictDetector {
    if (!ConflictDetector.instance) {
      ConflictDetector.instance = new ConflictDetector(
        new CommonDirDirectoryDiffer()
      );
    }
    return ConflictDetector.instance;
  }

  public async checkForConflicts(
    data: ConflictDetectionConfig
  ): Promise<DirectoryDiffResults> {
    const startTime = process.hrtime();
    this.diffs = Object.assign({}, ConflictDetector.EMPTY_DIFFS);
    this.error = undefined;

    try {
      const cacheExecutor = this.createCacheExecutor(
        data.username,
        this.handleCacheResults.bind(this)
      );
      const commandlet = new SfdxCommandlet<string>(
        new SfdxWorkspaceChecker(),
        new SimpleGatherer<string>(data.manifest),
        cacheExecutor
      );
      await commandlet.run();

      if (this.error) {
        throw this.error;
      }
    } catch (error) {
      this.reportError('conflict_detect_error', error);
      return Promise.reject(error);
    }

    telemetryService.sendCommandEvent('conflict_detect', startTime, undefined, {
      conflicts: this.diffs.different.size,
      orgFiles: this.diffs.scannedRemote ?? 0,
      localFiles: this.diffs.scannedLocal ?? 0
    });

    return this.diffs;
  }

  public createCacheExecutor(
    username: string,
    callback: MetadataCacheCallback
  ): MetadataCacheExecutor {
    const executor = new MetadataCacheExecutor(
      username,
      nls.localize('conflict_detect_execution_name'),
      'conflict_detect',
      callback,
      true
    );
    return executor;
  }

  private async handleCacheResults(
    username: string,
    result?: MetadataCacheResult
  ): Promise<void> {
    if (result) {
      const localPath = path.join(
        result.project.baseDirectory,
        result.project.commonRoot
      );
      const remotePath = path.join(
        result.cache.baseDirectory,
        result.cache.commonRoot
      );
      this.diffs = this.differ.diff(localPath, remotePath);
    } else {
      this.error = new Error(nls.localize('conflict_detect_empty_results'));
    }
  }

  private reportError(messageKey: string, error: Error) {
    console.error(error);
    const errorMsg = nls.localize(messageKey, error.toString());
    channelService.appendLine(errorMsg);
    telemetryService.sendException('ConflictDetectionException', errorMsg);
  }
}

export async function diffFolder(cache: MetadataCacheResult, username: string) {
  const localPath = path.join(
    cache.project.baseDirectory,
    cache.project.commonRoot
  );
  const remotePath = path.join(
    cache.cache.baseDirectory,
    cache.cache.commonRoot
  );
  const differ = new CommonDirDirectoryDiffer();
  const diffs = differ.diff(localPath, remotePath);

  conflictView.visualizeDifferences(
    nls.localize('force_source_diff_folder_title', username),
    username,
    true,
    diffs,
    true
  );
}

/**
 * Perform file diff and execute VS Code diff comand to show in UI.
 * It matches the correspondent file in compoennt.
 * @param localFile local file
 * @param remoteComponent remote source component
 * @param defaultUsernameorAlias username/org info to show in diff
 * @returns {Promise<void>}
 */
export async function diffOneFile(
  localFile: string,
  remoteComponent: SourceComponent,
  defaultUsernameorAlias: string
): Promise<void> {
  const filePart = path.basename(localFile);

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
