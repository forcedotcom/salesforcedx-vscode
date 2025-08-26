/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ContinueResponse,
  EmptyParametersGatherer,
  errorToString,
  SfWorkspaceChecker,
  SourceTrackingService,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';

import { PROJECT_DEPLOY_START_LOG_NAME } from '../constants';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { DeployRetrieveOperationType } from '../util/types';
import { DeployExecutor } from './deployExecutor';
import { SfCommandlet } from './util';

export class ProjectDeployStartExecutor extends DeployExecutor<{}> {
  constructor(showChannelOutput: boolean = true, ignoreConflicts: boolean = false) {
    const localizedCommandName = ignoreConflicts
      ? nls.localize('project_deploy_start_ignore_conflicts_default_org_text')
      : nls.localize('project_deploy_start_default_org_text');
    super(localizedCommandName, PROJECT_DEPLOY_START_LOG_NAME);
    this.showChannelOutput = showChannelOutput;
    this.ignoreConflicts = ignoreConflicts;
  }

  protected readonly operationType: DeployRetrieveOperationType = 'push';

  public async run(
    response: ContinueResponse<{}>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    const components = await this.getComponents(response);
    return this.performOperation(components, token);
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

        // Get local changes using the proper method
        const localComponentSets = await sourceTracking.localChangesAsComponentSet(false);
        const localComponentSet = localComponentSets[0] ?? new ComponentSet();

        return localComponentSet;
      } catch (error) {
        throw new Error(`Source tracking setup failed: ${errorToString(error)}`);
      }
    }

    // If source tracking is disabled, deploy all source
    return ComponentSet.fromSource(projectPath);
  }
}

export const projectDeployStart = async (isDeployOnSave: boolean, ignoreConflicts = false) => {
  const showOutputPanel = !(isDeployOnSave && !salesforceCoreSettings.getDeployOnSaveShowOutputPanel());
  const executor = new ProjectDeployStartExecutor(showOutputPanel, ignoreConflicts);

  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new EmptyParametersGatherer(), executor);
  await commandlet.run();
};
