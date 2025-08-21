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
  SourceTrackingService,
  errorToString,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, DeployResult, RequestStatus } from '@salesforce/source-deploy-retrieve';
import * as nodePath from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { TimestampFileProperties } from '../conflict/directoryDiffer';
import { getConflictMessagesFor } from '../conflict/messages';
import { MetadataCacheService } from '../conflict/metadataCacheService';
import { TimestampConflictDetector } from '../conflict/timestampConflictDetector';
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
    const localizedCommandName = ignoreConflicts
      ? nls.localize('project_deploy_start_ignore_conflicts_default_org_text')
      : nls.localize('project_deploy_start_default_org_text');
    super(localizedCommandName, PROJECT_DEPLOY_START_LOG_NAME);
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
    const components = await this.getComponents(response);

    // Only do conflict detection if:
    // 1. We're not ignoring conflicts, AND
    // 2. Conflict detection is enabled, AND
    // 3. Either:
    //    a) We have changed files to deploy (source tracking enabled with changes), OR
    //    b) Source tracking is disabled
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();
    if (
      !this.ignoreConflicts &&
      salesforceCoreSettings.getConflictDetectionEnabled() &&
      (this.changedFilePaths.length > 0 || !sourceTrackingEnabled)
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
    let result: DeployResult | undefined;

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
        if (!connection) {
          throw new Error(nls.localize('error_source_tracking_connection_failed'));
        }
        const sourceTracking = await SourceTrackingService.getSourceTracking(projectPath, connection);
        if (!sourceTracking) {
          throw new Error(nls.localize('error_source_tracking_service_failed'));
        }

        // Get local changes for deployment and conflict detection using the proper method
        const localComponentSets = await sourceTracking.localChangesAsComponentSet(false);
        const localComponentSet = localComponentSets.length > 0 ? localComponentSets[0] : new ComponentSet();

        // Populate changedFilePaths for conflict detection from local changes
        this.changedFilePaths = [];
        for (const component of localComponentSet.getSourceComponents()) {
          if (component.content) {
            const filePath = nodePath.isAbsolute(component.content)
              ? component.content
              : nodePath.resolve(projectPath, component.content);
            this.changedFilePaths.push(filePath);
          }
        }

        return localComponentSet;
      } catch (error) {
        // If source tracking fails, let the error bubble up
        console.error('Source tracking failed:', error);
        throw new Error(nls.localize('error_source_tracking_components_failed', errorToString(error)));
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

      // Use a single MetadataCacheService operation for all changed files
      const cacheService = new MetadataCacheService(username);
      const projectPath = workspaceUtils.getRootWorkspacePath();

      // Create a single cache operation for all changed files
      // If we have changedFilePaths (source tracking enabled), use those specific files
      // If we don't have changedFilePaths (source tracking disabled), use the entire project
      const componentPath =
        this.changedFilePaths.length > 0
          ? this.changedFilePaths.length === 1
            ? this.changedFilePaths[0]
            : this.changedFilePaths
          : projectPath;
      const result = await cacheService.loadCache(componentPath, projectPath, false);
      if (!result) {
        console.warn('No cache result available for conflict detection');
        return true; // Continue with deployment
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
          if (this.changedFilePaths.length === 0 || this.changedFilePaths.includes(conflictPath)) {
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
          const timestampChecker = new TimestampConflictChecker(false, messages, true);
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
