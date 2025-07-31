/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile, workspaceUtils, errorToString } from '@salesforce/salesforcedx-utils-vscode';
import * as nodePath from 'node:path';
import { channelService } from '../channels';
import { TimestampConflictChecker } from '../commands/util/timestampConflictChecker';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { TimestampFileProperties } from './directoryDiffer';
import { getConflictMessagesFor } from './messages';
import { MetadataCacheService } from './metadataCacheService';
import { TimestampConflictDetector } from './timestampConflictDetector';

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
 * Shared method to check for conflicts in changed files
 * @param conflictMessageType The type of conflict messages to use ('deploy_with_sourcepath' or 'retrieve_with_sourcepath')
 * @param changedFilePaths Array of changed file paths for conflict detection
 * @param isPushOperation Whether this is a push operation (affects conflict checker behavior)
 * @returns Promise<boolean> True if conflicts were resolved or no conflicts found, false if operation should be cancelled
 */
export const checkConflictsForChangedFiles = async (
  conflictMessageType: string,
  changedFilePaths: string[],
  isPushOperation: boolean,
  isPullOperation: boolean
): Promise<boolean> => {
  try {
    const messages = getConflictMessagesFor(conflictMessageType);
    if (!messages) {
      return true; // No conflict messages available, continue
    }

    // Show channel output and log conflict detection start once for the entire operation
    channelService.showChannelOutput();
    channelService.showCommandWithTimestamp(
      `${nls.localize('channel_starting_message')}${nls.localize('conflict_detect_execution_name')}\n`
    );

    const { username } = WorkspaceContext.getInstance();
    if (!username) {
      const errorMsg = nls.localize('conflict_detect_no_target_org');
      channelService.appendLine(errorMsg);
      return false;
    }

    // Use a single MetadataCacheService operation for all changed files
    const cacheService = new MetadataCacheService(username);
    const projectPath = workspaceUtils.getRootWorkspacePath();

    // Create a single cache operation for all changed files
    // If we have changedFilePaths (source tracking enabled), use those specific files
    // If we don't have changedFilePaths (source tracking disabled), use the entire project
    const componentPath =
      changedFilePaths.length > 0
        ? changedFilePaths.length === 1
          ? changedFilePaths[0]
          : changedFilePaths
        : projectPath;
    const result = await cacheService.loadCache(componentPath, projectPath, false);
    if (!result) {
      console.warn('No cache result available for conflict detection');
      return true; // Continue with operation
    }

    const detector = new TimestampConflictDetector();
    const diffs = await detector.createDiffs(result);

    if (diffs.different.size > 0) {
      // Filter conflicts to only include our changed files
      const relevantConflicts = new Set<TimestampFileProperties>();
      for (const conflict of diffs.different) {
        // Construct the full path by joining the local root (which includes project path) with the relative path
        const conflictPath = nodePath.join(diffs.localRoot, conflict.localRelPath);
        // If we have changedFilePaths (source tracking enabled), only check those files
        // If we don't have changedFilePaths (source tracking disabled), check all conflicts
        if (changedFilePaths.length === 0 || changedFilePaths.includes(conflictPath)) {
          relevantConflicts.add(conflict);
        }
      }

      if (relevantConflicts.size > 0) {
        // Create a new diffs object with only relevant conflicts
        const filteredDiffs = {
          ...diffs,
          different: relevantConflicts
        };

        // Create a TimestampConflictChecker to handle the conflicts
        const timestampChecker = new TimestampConflictChecker(false, messages, isPushOperation, isPullOperation);
        const conflictResult = await timestampChecker.handleConflicts(projectPath, username, filteredDiffs);

        // Log conflict detection end
        channelService.showCommandWithTimestamp(
          `${nls.localize('channel_end')} ${nls.localize('conflict_detect_execution_name')}\n`
        );

        return conflictResult.type === 'CONTINUE';
      }
    }

    // Log conflict detection end
    channelService.showCommandWithTimestamp(
      `${nls.localize('channel_end')} ${nls.localize('conflict_detect_execution_name')}\n`
    );

    return true; // No conflicts detected
  } catch (error) {
    console.error('Error during conflict detection:', error);
    const errorMsg = nls.localize('conflict_detect_error', errorToString(error));
    channelService.appendLine(errorMsg);
    telemetryService.sendException('ConflictDetectionException', errorMsg);
    return false; // Error occurred, cancel operation
  }
};
