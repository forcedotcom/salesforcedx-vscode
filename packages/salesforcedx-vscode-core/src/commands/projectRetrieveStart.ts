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
import { PROJECT_RETRIEVE_START_LOG_NAME } from '../constants';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { DeployRetrieveOperationType } from '../util/types';
import { RetrieveExecutor } from './retrieveExecutor';
import { SfCommandlet } from './util';

export class ProjectRetrieveStartExecutor extends RetrieveExecutor<{}> {
  constructor(ignoreConflicts: boolean = false) {
    super(nls.localize('project_retrieve_start_default_org_text'), PROJECT_RETRIEVE_START_LOG_NAME);
    this.ignoreConflicts = ignoreConflicts;
  }
  protected getOperationType(): DeployRetrieveOperationType {
    return 'pull';
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
    return this.performOperation(components, token);
  }

  /**
   * Returns the set of components to retrieve. Since this command is only available for source-tracked orgs,
   * we retrieve only remote changes. If there are no remote changes, returns an empty ComponentSet (no-op).
   */
  protected async getComponents(_response: ContinueResponse<{}>): Promise<ComponentSet> {
    await this.getLocalChanges();
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
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export const projectRetrieveStart = async (ignoreConflicts = false) => {
  const executor = new ProjectRetrieveStartExecutor(ignoreConflicts);
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
};
