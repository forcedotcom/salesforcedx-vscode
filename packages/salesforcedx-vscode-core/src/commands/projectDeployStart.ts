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
  isDirectory,
  isEmptyDirectory
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { getConflictMessagesFor } from '../conflict/messages';
import { PROJECT_DEPLOY_START_LOG_NAME } from '../constants';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { DeployExecutor } from './deployExecutor';
import { SfCommandlet } from './util';
import { TimestampConflictChecker } from './util/timestampConflictChecker';

export class ProjectDeployStartExecutor extends DeployExecutor<{}> {
  constructor(showChannelOutput: boolean = true) {
    super(nls.localize('project_deploy_start_default_org_text'), PROJECT_DEPLOY_START_LOG_NAME);
    this.showChannelOutput = showChannelOutput;
  }

  protected async getComponents(_response: ContinueResponse<{}>): Promise<ComponentSet> {
    // For project deploy start, we deploy all source in the project
    const projectPath = workspaceUtils.getRootWorkspacePath() ?? '';

    // Filter out empty folders before creating ComponentSet
    const filteredComponentSet = await this.createComponentSetWithoutEmptyFolders(projectPath);

    return filteredComponentSet;
  }

  /**
   * Creates a ComponentSet while filtering out empty folders that could cause deployment issues
   */
  // TODO: This is a temporary fix to avoid deploying empty folders. This should be fixed in SDR.
  private async createComponentSetWithoutEmptyFolders(projectPath: string): Promise<ComponentSet> {
    // First, get all source components to identify empty folders
    const tempComponentSet = ComponentSet.fromSource(projectPath);
    const sourceComponents = Array.from(tempComponentSet.getSourceComponents());

    // Identify components that are empty folders
    const emptyFolderPaths = new Set<string>();
    for (const component of sourceComponents) {
      if (!component.content) {
        continue; // No content path, skip
      }
      try {
        if (!(await isDirectory(component.content))) {
          continue; // It's a file, keep it
        }
        // It's a directory, check if it's empty or contains only empty subdirectories
        if (await isEmptyDirectory(component.content)) {
          emptyFolderPaths.add(component.content);
        }
      } catch {
        // If we can't stat the path, assume it's valid and let the deployment handle it
        continue;
      }
    }

    // Create a ComponentSet that excludes empty folder paths while preserving dependencies
    // Use ComponentSet.fromSource with include parameter to maintain dependency resolution
    const validComponents = Array.from(sourceComponents).filter(component => {
      if (!component.content) {
        return true; // Keep components without content path
      }
      return !emptyFolderPaths.has(component.content);
    });

    // Create a new ComponentSet with the valid components to preserve dependency resolution
    const filteredComponentSet = new ComponentSet();
    for (const component of validComponents) {
      filteredComponentSet.add(component);
    }

    return filteredComponentSet;
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
