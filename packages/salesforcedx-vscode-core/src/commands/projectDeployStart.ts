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
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as vscode from 'vscode';

import { PROJECT_DEPLOY_START_LOG_NAME } from '../constants';
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

  protected getOperationType(): DeployRetrieveOperationType {
    return 'push';
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
    return this.performOperation(components, token);
  }

  protected async getComponents(_response: ContinueResponse<{}>): Promise<ComponentSet> {
    const projectPath = workspaceUtils.getRootWorkspacePath() ?? '';
    const sourceTrackingEnabled = salesforceCoreSettings.getEnableSourceTrackingForDeployAndRetrieve();

    if (sourceTrackingEnabled) {
      return await this.getLocalChanges();
    }

    // If source tracking is disabled, deploy all source
    return ComponentSet.fromSource(projectPath);
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
