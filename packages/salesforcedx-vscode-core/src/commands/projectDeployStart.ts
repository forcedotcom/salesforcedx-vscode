/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ContinueResponse,
  EmptyParametersGatherer,
  SfWorkspaceChecker,
  workspaceUtils,
  SourceTrackingService
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, RequestStatus } from '@salesforce/source-deploy-retrieve-bundle';
import * as nodePath from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { getConflictMessagesFor } from '../conflict/messages';
import { PROJECT_DEPLOY_START_LOG_NAME, TELEMETRY_METADATA_COUNT } from '../constants';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { componentSetUtils } from '../services/sdr/componentSetUtils';
import { salesforceCoreSettings } from '../settings';
import { telemetryService } from '../telemetry';
import { DeployExecutor } from './deployExecutor';
import { SfCommandlet, createComponentCount, formatException } from './util';
import { TimestampConflictChecker } from './util/timestampConflictChecker';

export class ProjectDeployStartExecutor extends DeployExecutor<{}> {
  private isPushOp: boolean;
  private changedFilePaths: string[] = [];
  private ignoreConflicts: boolean;

  constructor(showChannelOutput: boolean = true, ignoreConflicts: boolean = false) {
    super(nls.localize('project_deploy_start_default_org_text'), PROJECT_DEPLOY_START_LOG_NAME);
    this.showChannelOutput = showChannelOutput;
    this.isPushOp = true;
    this.ignoreConflicts = ignoreConflicts;
  }

  public getChangedFilePaths(): string[] {
    return this.changedFilePaths;
  }

  public async run(
    response: ContinueResponse<{}>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    // Get components to determine changed files
    const components = await this.getComponents(response);

    // If conflict detection is enabled, ignoreConflicts is false, and we have changed files, check for conflicts
    if (
      !this.ignoreConflicts &&
      salesforceCoreSettings.getConflictDetectionEnabled() &&
      this.changedFilePaths.length > 0
    ) {
      const conflictResult = await this.checkConflictsForChangedFiles();
      if (!conflictResult) {
        return false; // Conflict detection failed or was cancelled
      }
    }

    // Continue with the normal deployment process using the components we already have
    return this.performDeployment(components, token);
  }

  private async performDeployment(components: ComponentSet, token?: vscode.CancellationToken): Promise<boolean> {
    let result: any;

    try {
      // Set API versions
      await componentSetUtils.setApiVersion(components);
      await componentSetUtils.setSourceApiVersion(components);

      // Add telemetry
      this.telemetry.addProperty(TELEMETRY_METADATA_COUNT, JSON.stringify(createComponentCount(components)));

      // Perform the operation
      result = await this.doOperation(components, token ?? new vscode.CancellationTokenSource().token);

      // If result is undefined, it means no components were processed (empty ComponentSet)
      // This is considered a successful operation since there's nothing to do
      if (result === undefined) {
        return true;
      }

      const status = result?.response.status;

      return status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial;
    } catch (e) {
      throw formatException(e);
    } finally {
      await this.postOperation(result);
    }
  }

  protected async getComponents(_response: ContinueResponse<{}>): Promise<ComponentSet> {
    const projectPath = workspaceUtils.getRootWorkspacePath() ?? '';
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();

    if (sourceTrackingEnabled) {
      try {
        const connection = await WorkspaceContext.getInstance().getConnection();
        const sourceTracking = await SourceTrackingService.getSourceTracking(projectPath, connection);

        // Get only the changed components from source tracking
        const statusResponse = await sourceTracking.getStatus({ local: true, remote: false });

        if (statusResponse.length === 0) {
          // No changes found, return empty ComponentSet
          return new ComponentSet();
        }

        // Filter for local changes that are not ignored
        const localChanges = statusResponse.filter(component => !component.ignored && component.origin === 'local');

        if (localChanges.length === 0) {
          // No local changes found, return empty ComponentSet
          return new ComponentSet();
        }

        const changedFilePaths: string[] = localChanges
          .map(component => component.filePath)
          .filter((filePath): filePath is string => !!filePath)
          .map(filePath =>
            // Ensure the file path is absolute and exists in the current workspace
            nodePath.isAbsolute(filePath) ? filePath : nodePath.resolve(projectPath, filePath)
          );

        if (changedFilePaths.length === 0) {
          // No file paths found, return empty ComponentSet
          return new ComponentSet();
        }

        // Store the changed file paths for conflict detection
        this.changedFilePaths = changedFilePaths;

        // Create ComponentSet from specific file paths
        return ComponentSet.fromSource(changedFilePaths);
      } catch (error) {
        // If source tracking fails, fall back to all source (old behavior)
        console.warn('Source tracking failed, falling back to all source:', error);
        return ComponentSet.fromSource(projectPath);
      }
    }

    // If source tracking is disabled, deploy all source
    return ComponentSet.fromSource(projectPath);
  }

  protected isPushOperation(): boolean {
    return this.isPushOp;
  }

  private async checkConflictsForChangedFiles(): Promise<boolean> {
    try {
      const messages = getConflictMessagesFor('deploy_with_sourcepath');
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

      // Create a single TimestampConflictChecker instance for all files
      const timestampChecker = new TimestampConflictChecker(false, messages, true);

      // Check conflicts for each changed file
      for (const filePath of this.changedFilePaths) {
        const success = await timestampChecker.checkFileWithoutLogging(filePath, username);
        if (!success) {
          // Log conflict detection end and return false
          channelService.showCommandWithTimestamp(
            `${nls.localize('channel_end')} ${nls.localize('conflict_detect_execution_name')}\n`
          );
          return false; // Conflict detected or error occurred, cancel deployment
        }
      }

      // Log conflict detection end
      channelService.showCommandWithTimestamp(
        `${nls.localize('channel_end')} ${nls.localize('conflict_detect_execution_name')}\n`
      );

      return true; // No conflicts detected or all conflicts were overridden
    } catch (error) {
      console.error('Error during conflict detection:', error);
      const errorMsg = nls.localize('conflict_detect_error', error.toString());
      channelService.appendLine(errorMsg);
      telemetryService.sendException('ConflictDetectionException', errorMsg);
      return false; // Error occurred, cancel deployment
    }
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export const projectDeployStart = async (isDeployOnSave: boolean, ignoreConflicts = false) => {
  const showOutputPanel = !(isDeployOnSave && !salesforceCoreSettings.getDeployOnSaveShowOutputPanel());
  const executor = new ProjectDeployStartExecutor(showOutputPanel, ignoreConflicts);

  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
};
