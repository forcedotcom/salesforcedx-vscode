/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse, EmptyParametersGatherer, SfWorkspaceChecker } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as vscode from 'vscode';
import { checkConflictsForChangedFiles } from '../conflict/conflictUtils';
import { PROJECT_DEPLOY_START_LOG_NAME } from '../constants';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { DeployExecutor } from './deployExecutor';
import { SfCommandlet } from './util';

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
      const conflictResult = await checkConflictsForChangedFiles(
        'deploy_with_sourcepath',
        this.changedFilePaths,
        true,
        false
      );
      if (!conflictResult) {
        return false; // Conflict detection failed or was cancelled
      }
    }

    // Continue with the normal deployment process using the components we already have
    return this.performOperation(components, token);
  }

  protected async getComponents(_response: ContinueResponse<{}>): Promise<ComponentSet> {
    return await this.setupSourceTrackingAndChangedFilePaths(this.changedFilePaths);
  }

  protected isPushOperation(): boolean {
    return this.isPushOp;
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
