/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse,
  PostconditionChecker,
  workspaceUtils,
  errorToString
} from '@salesforce/salesforcedx-utils-vscode';
import { basename, normalize } from 'node:path';
import { channelService } from '../../channels';
import { conflictView, DirectoryDiffResults, MetadataCacheService } from '../../conflict';
import { TimestampConflictDetector } from '../../conflict/timestampConflictDetector';
import { WorkspaceContext } from '../../context';
import { coerceMessageKey, nls } from '../../messages';
import { notificationService } from '../../notifications';
import { DeployQueue, salesforceCoreSettings } from '../../settings';
import { telemetryService } from '../../telemetry';
import { ConflictDetectionMessages } from './conflictDetectionMessages';

export class TimestampConflictChecker implements PostconditionChecker<string> {
  private isManifest: boolean;
  private messages: ConflictDetectionMessages;
  private isPushOperation: boolean;
  private isPullOperation: boolean;

  constructor(
    isManifest: boolean,
    messages: ConflictDetectionMessages,
    isPushOperation: boolean = false,
    isRetrieveOperation: boolean = false
  ) {
    this.messages = messages;
    this.isManifest = isManifest;
    this.isPushOperation = isPushOperation;
    this.isPullOperation = isRetrieveOperation;
  }

  public async check(
    inputs: ContinueResponse<string> | CancelResponse
  ): Promise<ContinueResponse<string> | CancelResponse> {
    if (!salesforceCoreSettings.getConflictDetectionEnabled()) {
      return inputs;
    }

    if (inputs.type === 'CONTINUE') {
      channelService.showChannelOutput();
      channelService.showCommandWithTimestamp(
        `${nls.localize('channel_starting_message')}${nls.localize('conflict_detect_execution_name')}\n`
      );

      const { username } = WorkspaceContext.getInstance();
      if (!username) {
        return {
          type: 'CANCEL',
          msg: nls.localize('conflict_detect_no_target_org')
        };
      }

      const componentPath = inputs.data;
      const cacheService = new MetadataCacheService(username);

      try {
        const result = await cacheService.loadCache(
          componentPath,
          workspaceUtils.getRootWorkspacePath(),
          this.isManifest
        );
        const detector = new TimestampConflictDetector();
        const diffs = await detector.createDiffs(result);

        channelService.showCommandWithTimestamp(
          `${nls.localize('channel_end')} ${nls.localize('conflict_detect_execution_name')}\n`
        );
        return await this.handleConflicts(inputs.data, username, diffs);
      } catch (error) {
        console.error(error);
        const errorMsg = nls.localize('conflict_detect_error', errorToString(error));
        channelService.appendLine(errorMsg);
        telemetryService.sendException('ConflictDetectionException', errorMsg);
        await DeployQueue.get().unlock();
      }
    }
    return { type: 'CANCEL' };
  }

  public async handleConflicts(
    componentPath: string,
    usernameOrAlias: string,
    results: DirectoryDiffResults
  ): Promise<ContinueResponse<string> | CancelResponse> {
    const conflictTitle = nls.localize('conflict_detect_view_root', usernameOrAlias, results.different.size);

    if (results.different.size === 0) {
      conflictView.visualizeDifferences(conflictTitle, usernameOrAlias, false);
    } else {
      channelService.appendLine(nls.localize('conflict_detect_conflict_header_timestamp', results.different.size));
      results.different.forEach(file => {
        channelService.appendLine(normalize(basename(file.localRelPath)));
      });

      const showConflictsText = this.isPullOperation
        ? nls.localize('conflict_detect_show_conflicts_retrieve')
        : nls.localize('conflict_detect_show_conflicts_deploy');
      const overrideText = this.isPullOperation
        ? nls.localize('conflict_detect_override_retrieve')
        : nls.localize('conflict_detect_override_deploy');

      const choice = await notificationService.showWarningModal(
        nls.localize(coerceMessageKey(this.messages.warningMessageKey)),
        showConflictsText,
        overrideText
      );

      if (choice === overrideText) {
        conflictView.visualizeDifferences(conflictTitle, usernameOrAlias, false);
      } else {
        if (this.isPushOperation) {
          channelService.appendLine(nls.localize('conflict_detect_command_hint_push'));
        } else if (this.isPullOperation) {
          channelService.appendLine(nls.localize('conflict_detect_command_hint_pull'));
        } else {
          channelService.appendLine(this.messages.commandHint(componentPath));
        }

        const doReveal = choice === showConflictsText;
        conflictView.visualizeDifferences(conflictTitle, usernameOrAlias, doReveal, results);

        await DeployQueue.get().unlock();
        return { type: 'CANCEL' };
      }
    }
    return { type: 'CONTINUE', data: componentPath };
  }
}
