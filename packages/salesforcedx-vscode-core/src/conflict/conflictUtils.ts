/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile, workspaceUtils, errorToString } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import type { ChangeResult } from '@salesforce/source-tracking';
import * as path from 'node:path';

import { channelService } from '../channels';
import { TimestampConflictChecker } from '../commands/util/timestampConflictChecker';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { telemetryService } from '../telemetry';
import { DeployRetrieveOperationType } from '../util/types';
import { diffComponents } from './componentDiffer';
import { DirectoryDiffResults, TimestampFileProperties } from './directoryDiffer';
import { getConflictMessagesFor, ConflictLogName } from './messages';
import { MetadataCacheService } from './metadataCacheService';

/**
 * Compares two files to determine if they differ in content.
 * Reads both files in parallel for better performance.
 * @param one Path to the first file
 * @param two Path to the second file
 * @returns Promise<boolean> True if files differ, false if they are identical
 */
export const filesDiffer = async (one: string, two: string): Promise<boolean> => {
  const [buffer1, buffer2] = await Promise.all([readFile(one), readFile(two)]);
  return buffer1 !== buffer2;
};

/**
 * Handles conflicts by showing VS Code's conflict UI and allowing user interaction
 * @param conflicts Array of conflicts from SourceTracking.getConflicts() or SDR error
 * @param conflictMessageType The type of conflict messages to use ('deploy_with_sourcepath', 'retrieve_with_sourcepath', etc.)
 * @param operationType The type of operation ('deploy', 'retrieve', 'push', 'pull')
 * @param operation The original operation function
 * @param retryOperation Optional function to retry the operation with ignoreConflicts: true
 * @returns Promise<T> The result of operation, or undefined if user cancels
 */
export const handleConflictsWithUI = async <T>(
  conflicts: ChangeResult[],
  conflictMessageType: ConflictLogName,
  operationType: DeployRetrieveOperationType,
  operation: () => Promise<T>,
  retryOperation?: () => Promise<T>
): Promise<T | undefined> => {
  try {
    const messages = getConflictMessagesFor(conflictMessageType);

    // Show channel output and log conflict detection start
    channelService.showChannelOutput();
    channelService.showCommandWithTimestamp(
      `${nls.localize('channel_starting_message')}${nls.localize('conflict_detect_execution_name')}\n`
    );

    const { username } = WorkspaceContext.getInstance();
    if (!username) {
      const errorMsg = nls.localize('conflict_detect_no_target_org');
      channelService.appendLine(errorMsg);
      throw new Error(errorMsg);
    }

    const projectPath = workspaceUtils.getRootWorkspacePath();

    // For SourceTracking conflicts, we need to retrieve remote content to show diffs
    const conflictResults = await createConflictResultsWithRemoteContent(conflicts, projectPath, username);

    // Create a TimestampConflictChecker to handle the conflicts with VS Code UI
    const conflictChecker = new TimestampConflictChecker(false, messages, operationType);
    const conflictResult = await conflictChecker.handleConflicts(projectPath, username, conflictResults);

    // Log conflict detection end
    channelService.showCommandWithTimestamp(
      `${nls.localize('channel_end')} ${nls.localize('conflict_detect_execution_name')}\n`
    );

    if (conflictResult?.type === 'CONTINUE') {
      // User chose to continue - retry the operation if a retry function is provided
      if (retryOperation) {
        return await retryOperation();
      } else {
        // If no retry function, proceed with original operation
        return await operation();
      }
    } else {
      // User cancelled
      return undefined;
    }
  } catch (handlingError) {
    console.error('Conflict handling failed:', handlingError);
    const errorMsg = nls.localize('conflict_detect_error', errorToString(handlingError));
    telemetryService.sendException('ConflictDetectionException', errorMsg);
    // If conflict handling fails, throw an error
    throw new Error(errorMsg);
  }
};

/** Resolves conflict metadata component references to all associated file paths */
const resolveConflictFilePaths = async (conflicts: ChangeResult[]): Promise<string[]> => {
  const conflictFilePaths = conflicts.flatMap(conflict => conflict.filenames ?? []);

  // Check if conflicts already contain valid file paths
  const hasValidFilePaths = conflictFilePaths.some(
    filePath => filePath !== 'unknown' && filePath.includes(path.sep) && !filePath.includes(' ')
  );

  if (hasValidFilePaths) {
    return conflictFilePaths.filter((filePath): filePath is string => filePath !== 'unknown');
  }

  // Convert metadata component info to file paths using ComponentSet
  const componentRefs = conflicts.map((conflict: any) => ({
    fullName: conflict.fullName ?? conflict.name,
    type: conflict.type ?? 'ApexClass' // Default assumption
  }));

  const packageDirs = await SalesforcePackageDirectories.getPackageDirectoryFullPaths();
  const projectComponentSet = ComponentSet.fromSource({
    fsPaths: packageDirs,
    include: new ComponentSet(componentRefs)
  });

  const actualFilePaths: string[] = [];
  for (const component of projectComponentSet.getSourceComponents()) {
    if (component.content) {
      actualFilePaths.push(component.content);
    }
    if (component.xml) {
      actualFilePaths.push(component.xml);
    }
  }

  return actualFilePaths;
};

/**
 * Creates DirectoryDiffResults from cache result and project components
 */
const createDiffResultsFromCache = async (
  cacheResult: any,
  actualFilePaths: string[]
): Promise<DirectoryDiffResults> => {
  const different = new Set<TimestampFileProperties>();

  // Match cache components with project components and find differences
  for (const cacheComponent of cacheResult.cache.components) {
    const projectComponent = cacheResult.project.components.find(
      (proj: any) => proj.fullName === cacheComponent.fullName && proj.type === cacheComponent.type
    );

    if (projectComponent) {
      const differences = await diffComponents(projectComponent, cacheComponent);
      if (differences?.length > 0) {
        differences.forEach(difference => {
          const localRelPath = path.relative(cacheResult.project.baseDirectory, difference.projectPath);
          const remoteRelPath = path.relative(cacheResult.cache.baseDirectory, difference.cachePath);

          different.add({
            localRelPath,
            remoteRelPath,
            localLastModifiedDate: 'local',
            remoteLastModifiedDate: 'remote'
          });
        });
      }
    }
  }

  return {
    different,
    localRoot: cacheResult.project.baseDirectory,
    remoteRoot: cacheResult.cache.baseDirectory,
    scannedLocal: actualFilePaths.length,
    scannedRemote: actualFilePaths.length
  };
};

/**
 * Converts SourceTracking conflicts to VS Code DirectoryDiffResults format
 * using MetadataCacheService to retrieve remote content for file diffs.
 */
const createConflictResultsWithRemoteContent = async (
  conflicts: ChangeResult[],
  projectPath: string,
  username: string
): Promise<DirectoryDiffResults> => {
  try {
    // Step 1: Resolve conflict metadata to actual file paths
    const actualFilePaths = await resolveConflictFilePaths(conflicts);

    if (actualFilePaths.length === 0) {
      console.warn('Could not resolve any file paths from conflicts, falling back to simple conflict list');
      return createSimpleConflictResults(conflicts, projectPath);
    }

    // Step 2: Use MetadataCacheService to retrieve remote content
    const cacheService = new MetadataCacheService(username);
    const cacheResult = await cacheService.loadCache(actualFilePaths, projectPath);

    if (!cacheResult) {
      console.warn('Failed to retrieve remote content for conflicts');
      return createSimpleConflictResults(conflicts, projectPath);
    }

    // Step 3: Create diff results from cached components
    return await createDiffResultsFromCache(cacheResult, actualFilePaths);
  } catch (error) {
    console.warn('Failed to create conflict results with remote content:', error);
    return createSimpleConflictResults(conflicts, projectPath);
  }
};

/**
 * Creates a simple conflict results list without file diffs (fallback)
 */
const createSimpleConflictResults = (conflicts: any[], projectPath: string): DirectoryDiffResults => {
  const different = new Set<TimestampFileProperties>(
    conflicts.map((conflict: any) => {
      const filePath = conflict.filePath ?? conflict.fullName ?? conflict.name ?? 'unknown';
      const localRelPath = path.isAbsolute(filePath) ? path.relative(projectPath, filePath) : filePath;

      return {
        localRelPath,
        remoteRelPath: localRelPath, // No remote file available
        localLastModifiedDate: 'local',
        remoteLastModifiedDate: 'remote'
      };
    })
  );

  return {
    different,
    localRoot: projectPath,
    remoteRoot: projectPath, // Same as local since no remote files
    scannedLocal: conflicts.length,
    scannedRemote: conflicts.length
  };
};
