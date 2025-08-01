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
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';

import * as vscode from 'vscode';
import { checkConflictsForChangedFiles } from '../conflict/conflictUtils';
import { PROJECT_RETRIEVE_START_LOG_NAME } from '../constants';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { RetrieveExecutor } from './retrieveExecutor';
import { SfCommandlet } from './util';

export class ProjectRetrieveStartExecutor extends RetrieveExecutor<{}> {
  private changedFilePaths: string[] = [];
  private ignoreConflicts: boolean;

  constructor(ignoreConflicts: boolean = false) {
    super(nls.localize('project_retrieve_start_default_org_text'), PROJECT_RETRIEVE_START_LOG_NAME);
    this.ignoreConflicts = ignoreConflicts;
  }
  protected isPullOperation(): boolean {
    return true;
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

    // Check for conflicts if:
    // 1. We're not ignoring conflicts
    // 2. Conflict detection is enabled
    // 3. Either:
    //    a) There are changed files to check for conflicts, OR
    //    b) Source tracking is disabled
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();
    if (
      !this.ignoreConflicts &&
      salesforceCoreSettings.getConflictDetectionEnabled() &&
      (this.changedFilePaths.length > 0 || !sourceTrackingEnabled)
    ) {
      const conflictResult = await checkConflictsForChangedFiles(
        'retrieve_with_sourcepath',
        this.changedFilePaths,
        false,
        true
      );
      if (!conflictResult) {
        return false; // Conflict detection failed or was cancelled
      }
    }

    // Continue with the normal retrieve process using the components we already have
    return this.performOperation(components, token);
  }

  /**
   * Returns the set of components to retrieve. If source tracking is enabled and the org is source-tracked,
   * retrieves only remote changes. If there are no remote changes, returns an empty ComponentSet (no-op).
   * If source tracking is disabled, retrieve all source.
   */
  protected async getComponents(_response: ContinueResponse<{}>): Promise<ComponentSet> {
    await this.setupSourceTrackingAndChangedFilePaths(this.changedFilePaths);

    // If source tracking is enabled, get remote changes
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();
    if (sourceTrackingEnabled) {
      try {
        const projectPath = workspaceUtils.getRootWorkspacePath() ?? '';
        const connection = await WorkspaceContext.getInstance().getConnection();
        if (!connection) {
          throw new Error(nls.localize('error_source_tracking_connection_failed'));
        }

        // Clear the source tracking cache to ensure we get a fresh instance
        SourceTrackingService.clearSourceTracking(projectPath, connection);

        const sourceTracking = await SourceTrackingService.getSourceTracking(projectPath, connection);
        if (!sourceTracking) {
          throw new Error(nls.localize('error_source_tracking_service_failed'));
        }

        // Use the same approach as CLI: apply remote deletes and get component set
        // This ensures proper state management and updates
        const result = await sourceTracking.maybeApplyRemoteDeletesToLocal(true);

        // Log the number of remote changes found for debugging
        console.log(`Found ${result.componentSetFromNonDeletes.size} remote changes to retrieve`);

        // Return the component set from the result, which includes proper state updates
        return result.componentSetFromNonDeletes;
      } catch (error) {
        // If source tracking fails, let the error bubble up
        console.error('Source tracking failed:', error);
        throw new Error(nls.localize('error_source_tracking_components_failed', error));
      }
    }

    // If source tracking is disabled or no local changes, retrieve all source
    return ComponentSet.fromSource(workspaceUtils.getRootWorkspacePath() ?? '');
  }

  public getChangedFilePaths(): string[] {
    return this.changedFilePaths;
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export const projectRetrieveStart = async (ignoreConflicts = false) => {
  const executor = new ProjectRetrieveStartExecutor(ignoreConflicts);
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
};
