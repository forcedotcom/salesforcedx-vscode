/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { channelService } from '../channels';
import {
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  SimpleGatherer
} from '../commands/util';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import {
  CommonDirDirectoryDiffer,
  DirectoryDiffer,
  DirectoryDiffResults
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
  private static EMPTY_DIFFS = Object.freeze({
    localRoot: '',
    remoteRoot: '',
    different: new Set<string>(),
    scannedLocal: 0,
    scannedRemote: 0
  });

  constructor(differ?: DirectoryDiffer) {
    this.differ = differ || new CommonDirDirectoryDiffer();
    this.diffs = ConflictDetector.EMPTY_DIFFS;
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
    this.diffs = ConflictDetector.EMPTY_DIFFS;
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
      orgFiles: this.diffs.scannedRemote,
      localFiles: this.diffs.scannedLocal
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
