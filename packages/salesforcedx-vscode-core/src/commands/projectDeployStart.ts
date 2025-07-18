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
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { getConflictMessagesFor } from '../conflict/messages';
import { PROJECT_DEPLOY_START_LOG_NAME } from '../constants';
import { WorkspaceContext } from '../context/workspaceContext';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { DeployExecutor } from './deployExecutor';
import { SfCommandlet } from './util';
import { TimestampConflictChecker } from './util/timestampConflictChecker';

export class ProjectDeployStartExecutor extends DeployExecutor<{}> {
  private isPushOp: boolean;

  constructor(showChannelOutput: boolean = true) {
    super(nls.localize('project_deploy_start_default_org_text'), PROJECT_DEPLOY_START_LOG_NAME);
    this.showChannelOutput = showChannelOutput;
    this.isPushOp = true;
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
          .filter((path): path is string => !!path);

        if (changedFilePaths.length === 0) {
          // No file paths found, return empty ComponentSet
          return new ComponentSet();
        }

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
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export const projectDeployStart = async (isDeployOnSave: boolean, ignoreConflicts = false) => {
  const showOutputPanel = !(isDeployOnSave && !salesforceCoreSettings.getDeployOnSaveShowOutputPanel());
  const executor = new ProjectDeployStartExecutor(showOutputPanel);
  const messages = getConflictMessagesFor('deploy_with_sourcepath');
  const checker = ignoreConflicts || !messages ? undefined : new TimestampConflictChecker(false, messages);

  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor, checker);
  await commandlet.run();
};
