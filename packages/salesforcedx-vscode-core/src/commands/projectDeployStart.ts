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
import { ComponentSet, DeployResult, RequestStatus } from '@salesforce/source-deploy-retrieve-bundle';
import * as nodePath from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { TimestampFileProperties } from '../conflict/directoryDiffer';
import { getConflictMessagesFor } from '../conflict/messages';
import { MetadataCacheService } from '../conflict/metadataCacheService';
import { TimestampConflictDetector } from '../conflict/timestampConflictDetector';
import { PROJECT_DEPLOY_START_LOG_NAME, TELEMETRY_METADATA_COUNT } from '../constants';
import { workspaceContextUtils } from '../context';
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

    // Only do conflict detection if:
    // 1. Conflict detection is enabled
    // 2. We're not ignoring conflicts (SFDX: Push Source to Default Org command)
    // 3. We have components to deploy
    // 4. Source tracking is enabled (changedFilePaths is not empty)
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();
    if (
      !this.ignoreConflicts &&
      salesforceCoreSettings.getConflictDetectionEnabled() &&
      components.size > 0 &&
      sourceTrackingEnabled &&
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

        // Get only the changed components from source tracking
        const statusResponse = await sourceTracking.getStatus({ local: true, remote: false });

        if (statusResponse.length === 0) {
          // No changes found - this could be a new org with no existing metadata
          // Check if this is a "first deployment" scenario by checking if the org has any existing metadata
          try {
            const orgType = await workspaceContextUtils.getWorkspaceOrgType();
            if (orgType === workspaceContextUtils.OrgType.SourceTracked) {
              // For source-tracked orgs, check if there's any remote metadata
              const remoteStatusResponse = await sourceTracking.getStatus({ local: false, remote: true });
              if (remoteStatusResponse.length === 0) {
                // No remote metadata found - this is likely a first deployment
                // Check if there are source files to deploy
                const allSourceComponents = ComponentSet.fromSource(projectPath);
                if (allSourceComponents && allSourceComponents.size > 0) {
                  console.log(
                    'No source tracking changes found and no remote metadata exists. This appears to be a first deployment to a new org. Deploying all source files.'
                  );
                  return allSourceComponents;
                }
              }
            }
          } catch {
            // If we can't determine org type or get remote status, be conservative and return empty
            console.log('Could not determine if this is a first deployment scenario, returning empty ComponentSet');
          }

          // No changes found and not a first deployment - return empty ComponentSet
          // This will result in "No results found" output
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
        // If source tracking fails, let the error bubble up
        console.error('Source tracking failed:', error);
        throw new Error(nls.localize('error_source_tracking_components_failed', error));
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
