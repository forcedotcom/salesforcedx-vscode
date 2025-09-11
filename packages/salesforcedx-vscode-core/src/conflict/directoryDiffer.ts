/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readDirectory, isDirectory } from '@salesforce/salesforcedx-utils-vscode';
import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
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

type FileStats = {
  filename: string;
  subdir: string;
  relPath: string;
};

/** Recursively walk directory and return list of FileStats objects */
const walkFiles = async (root: string, subdir: string = ''): Promise<FileStats[]> => {
  const fullDir = path.join(root, subdir);
  const subdirList = await readDirectory(fullDir);

  return (
    await Promise.all(
      subdirList.flatMap(async filename => {
        const fullPath = path.join(fullDir, filename);
        const relPath = path.join(subdir, filename);
        return (await isDirectory(fullPath)) ? walkFiles(root, relPath) : [{ filename, subdir, relPath }];
      })
    )
  ).flat();
};

export type TimestampFileProperties = {
  localRelPath: string;
  remoteRelPath: string;
  localLastModifiedDate?: string;
  remoteLastModifiedDate?: string;
};

export type DirectoryDiffResults = {
  different: Set<TimestampFileProperties>;
  localRoot: string;
  remoteRoot: string;
  scannedLocal?: number;
  scannedRemote?: number;
};

const diff = async (localSourcePath: string, remoteSourcePath: string): Promise<DirectoryDiffResults> => {
  const [localFiles, remoteFiles] = (await Promise.all([walkFiles(localSourcePath), walkFiles(remoteSourcePath)])).map(
    fileList => fileList.map(f => f.relPath)
  );
  const localSet = new Set(localFiles);

  // process remote files to generate differences
  const different = new Set(
    (
      await Promise.all(
        remoteFiles
          .filter(remoteFile => localSet.has(remoteFile))
          .map(async relPath => {
            const file1 = path.join(localSourcePath, relPath);
            const file2 = path.join(remoteSourcePath, relPath);
            const isDifferent = await filesDiffer(file1, file2);
            return isDifferent ? { localRelPath: relPath, remoteRelPath: relPath } : undefined;
          })
      )
    ).filter(rf => rf !== undefined)
  );

  return {
    localRoot: localSourcePath,
    remoteRoot: remoteSourcePath,
    different,
    scannedLocal: localSet.size,
    scannedRemote: remoteFiles.length
  };
};

export const diffFolder = async (cache: MetadataCacheResult, username: string): Promise<void> => {
  const localPath = path.join(cache.project.baseDirectory, cache.project.commonRoot);
  const remotePath = path.join(cache.cache.baseDirectory, cache.cache.commonRoot);
  const diffs = await diff(localPath, remotePath);

  conflictView.visualizeDifferences(nls.localize('source_diff_folder_title', username), username, true, diffs, true);
};

export const diffMultipleFiles = async (
  username: string,
  selectedPaths: string[],
  cache: MetadataCacheResult
): Promise<void> => {
  // Process files in parallel
  const diffEntries = await Promise.all(
    selectedPaths.slice(0, cache.cache.components.length).map(async (localFile, index) => {
      const remoteComponent = cache.cache.components[index];

      // Create a diff entry for each file
      const localRelPath = path.relative(cache.project.baseDirectory, localFile);
      const remoteRelPath = path.relative(
        cache.cache.baseDirectory,
        remoteComponent.content ?? remoteComponent.xml ?? ''
      );

      return {
        localRelPath,
        remoteRelPath,
        localLastModifiedDate: undefined,
        remoteLastModifiedDate: undefined
      };
    })
  );

  const different = new Set<TimestampFileProperties>(diffEntries);

  const diffResults = {
    different,
    localRoot: cache.project.baseDirectory,
    remoteRoot: cache.cache.baseDirectory,
    scannedLocal: selectedPaths.length,
    scannedRemote: cache.cache.components.length
  };

  // Show all diffs in the sidebar like folder diff
  conflictView.visualizeDifferences(
    nls.localize('source_diff_folder_title', username),
    username,
    true,
    diffResults,
    true
  );
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
  const remoteFilePaths = [
    ...remoteComponent.walkContent(),
    ...(remoteComponent.xml ? [remoteComponent.xml] : [])
  ].filter(filePath => filePath.endsWith(filePart));

  for (const filePath of remoteFilePaths) {
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
};
