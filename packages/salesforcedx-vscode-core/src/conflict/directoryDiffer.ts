/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve-bundle';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { conflictView } from '../conflict';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
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

export type DirectoryDiffer = {
  diff(localSourcePath: string, remoteSourcePath: string): DirectoryDiffResults;
};

type FileStats = {
  filename: string;
  subdir: string;
  relPath: string;
};

export class CommonDirDirectoryDiffer implements DirectoryDiffer {
  constructor() {}

  public diff(localSourcePath: string, remoteSourcePath: string): DirectoryDiffResults {
    const localSet = this.listFiles(localSourcePath);
    const different = new Set<TimestampFileProperties>();

    // process remote files to generate differences
    let scannedRemote = 0;
    this.walkFiles(remoteSourcePath, '', stats => {
      scannedRemote++;
      if (localSet.has(stats.relPath)) {
        const file1 = path.join(localSourcePath, stats.relPath);
        const file2 = path.join(remoteSourcePath, stats.relPath);
        if (this.filesDiffer(file1, file2)) {
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
    } as DirectoryDiffResults;
  }

  private filesDiffer(one: string, two: string): boolean {
    const buffer1 = fs.readFileSync(one);
    const buffer2 = fs.readFileSync(two);
    return !buffer1.equals(buffer2);
  }

  private listFiles(root: string): Set<string> {
    const results = new Set<string>();
    this.walkFiles(root, '', stats => {
      results.add(stats.relPath);
    });
    return results;
  }

  private walkFiles(root: string, subdir: string, callback: (stats: FileStats) => void) {
    const fullDir = path.join(root, subdir);
    const subdirList = fs.readdirSync(fullDir);

    subdirList.forEach(filename => {
      const fullPath = path.join(fullDir, filename);
      const stat = fs.statSync(fullPath);
      const relPath = path.join(subdir, filename);

      if (stat && stat.isDirectory()) {
        this.walkFiles(root, relPath, callback);
      } else {
        callback({ filename, subdir, relPath });
      }
    });
  }
}

export const diffFolder = (cache: MetadataCacheResult, username: string) => {
  const localPath = path.join(cache.project.baseDirectory, cache.project.commonRoot);
  const remotePath = path.join(cache.cache.baseDirectory, cache.cache.commonRoot);
  const differ = new CommonDirDirectoryDiffer();
  const diffs = differ.diff(localPath, remotePath);

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
      const remoteUri = vscode.Uri.file(filePath);
      const localUri = vscode.Uri.file(localFile);

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
