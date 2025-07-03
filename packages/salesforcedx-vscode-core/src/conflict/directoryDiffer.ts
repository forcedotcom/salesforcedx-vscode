/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readDirectory, isDirectory } from '@salesforce/salesforcedx-utils-vscode';
import { SourceComponent } from '@salesforce/source-deploy-retrieve-bundle';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { channelService } from '../channels';
import { conflictView } from '../conflict';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { filesDiffer } from './conflictUtils';
import { MetadataCacheResult } from './metadataCacheService';

export type TimestampFileProperties = {
  localRelPath: string;
  remoteRelPath: string;
  localLastModifiedDate?: string | undefined;
  remoteLastModifiedDate?: string | undefined;
};

export type DirectoryDiffResults = {
  different: Set<TimestampFileProperties>;
  localRoot: string;
  remoteRoot: string;
  scannedLocal?: number;
  scannedRemote?: number;
};

type DirectoryDiffer = {
  diff(localSourcePath: string, remoteSourcePath: string): Promise<DirectoryDiffResults>;
};

type FileStats = {
  filename: string;
  subdir: string;
  relPath: string;
};

class CommonDirDirectoryDiffer implements DirectoryDiffer {
  public async diff(localSourcePath: string, remoteSourcePath: string): Promise<DirectoryDiffResults> {
    const localSet = await this.listFiles(localSourcePath);
    const different = new Set<TimestampFileProperties>();

    // process remote files to generate differences
    let scannedRemote = 0;
    await this.walkFiles(remoteSourcePath, '', async stats => {
      scannedRemote++;
      if (localSet.has(stats.relPath)) {
        const file1 = path.join(localSourcePath, stats.relPath);
        const file2 = path.join(remoteSourcePath, stats.relPath);
        if (await filesDiffer(file1, file2)) {
          different.add({
            localRelPath: stats.relPath,
            remoteRelPath: stats.relPath
          });
        }
      }
    });

    return {
      localRoot: localSourcePath,
      remoteRoot: remoteSourcePath,
      different,
      scannedLocal: localSet.size,
      scannedRemote
    };
  }

  private async listFiles(root: string): Promise<Set<string>> {
    const results = new Set<string>();
    await this.walkFiles(root, '', stats => {
      results.add(stats.relPath);
    });
    return results;
  }

  private async walkFiles(root: string, subdir: string, callback: (stats: FileStats) => Promise<void>) {
    const fullDir = path.join(root, subdir);
    const subdirList = await readDirectory(fullDir);

    for (const filename of subdirList) {
      const fullPath = path.join(fullDir, filename);
      const relPath = path.join(subdir, filename);

      if (await isDirectory(fullPath)) {
        await this.walkFiles(root, relPath, callback);
      } else {
        await callback({ filename, subdir, relPath });
      }
    }
  }
}

export const diffFolder = async (cache: MetadataCacheResult, username: string): Promise<void> => {
  const localPath = path.join(cache.project.baseDirectory, cache.project.commonRoot);
  const remotePath = path.join(cache.cache.baseDirectory, cache.cache.commonRoot);
  const differ = new CommonDirDirectoryDiffer();
  const diffs = await differ.diff(localPath, remotePath);

  conflictView.visualizeDifferences(nls.localize('source_diff_folder_title', username), username, true, diffs, true);
};

/**
 * Perform file diff and execute VS Code diff comand to show in UI.
 * It matches the correspondent file in compoennt.
 * @param localFile local file
 * @param remoteComponent remote source component
 * @param targetOrgorAlias username/org info to show in diff
 * @returns {Promise<void>}
 */
export const diffOneFile = async (
  localFile: string,
  remoteComponent: SourceComponent,
  targetOrgorAlias: string
): Promise<void> => {
  const filePart = path.basename(localFile);

  const remoteFilePaths = remoteComponent.walkContent();
  if (remoteComponent.xml) {
    remoteFilePaths.push(remoteComponent.xml);
  }
  for (const filePath of remoteFilePaths) {
    if (filePath.endsWith(filePart)) {
      const remoteUri = URI.file(filePath);
      const localUri = URI.file(localFile);

      try {
        await vscode.commands.executeCommand(
          'vscode.diff',
          remoteUri,
          localUri,
          nls.localize('source_diff_title', targetOrgorAlias, filePart, filePart)
        );
      } catch (err) {
        await notificationService.showErrorMessage(err.message);
        channelService.appendLine(err.message);
        channelService.showChannelOutput();
        telemetryService.sendException('source_diff_file', `Error: name = ${err.name} message = ${err.message}`);
      }
      return;
    }
  }
};
