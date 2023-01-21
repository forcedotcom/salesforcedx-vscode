/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTrackingService } from '@salesforce/salesforcedx-utils';
import {
  ConfigUtil,
  getRelativeProjectPath,
  getRootWorkspacePath,
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, DeployResult } from '@salesforce/source-deploy-retrieve';
import { RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { WorkspaceContext } from '../../context/workspaceContext';
import { handleDeployDiagnostics } from '../../diagnostics';
import { nls } from '../../messages';
import { DeployQueue } from '../../settings';
import { SfdxPackageDirectories } from '../../sfdxProject';
import { BaseDeployExecutor } from '../baseDeployCommand';
import { DeployRetrieveExecutor } from '../baseDeployRetrieve';

export abstract class DeployExecutor<T> extends DeployRetrieveExecutor<T> {
  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<DeployResult | undefined> {
    const connection = await WorkspaceContext.getInstance().getConnection();
    const username = await ConfigUtil.getUsername();
    const projectPath = getRootWorkspacePath();
    if (username) {
      const sourceTracking = await SourceTrackingService.createSourceTracking(
        username,
        projectPath
      );
    }
    const operation = await components.deploy({
      usernameOrConnection: connection
    });

    this.setupCancellation(operation, token);

    return operation.pollStatus();
  }

  protected async postOperation(
    result: DeployResult | undefined
  ): Promise<void> {
    try {
      if (result) {
        BaseDeployExecutor.errorCollection.clear();

        const relativePackageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
        const output = this.createOutput(result, relativePackageDirs);
        channelService.appendLine(output);

        const success = result.response.status === RequestStatus.Succeeded;
        if (!success) {
          handleDeployDiagnostics(result, BaseDeployExecutor.errorCollection);
        }
      }
    } finally {
      await DeployQueue.get().unlock();
    }
  }

  private createOutput(
    result: DeployResult,
    relativePackageDirs: string[]
  ): string {
    const table = new Table();

    const rowsWithRelativePaths = (result.getFileResponses().map(response => {
      response.filePath = getRelativeProjectPath(
        response.filePath,
        relativePackageDirs
      );
      return response;
    }) as unknown) as Row[];

    let output: string;

    if (result.response.status === RequestStatus.Succeeded) {
      output = table.createTable(
        rowsWithRelativePaths,
        [
          { key: 'state', label: nls.localize('table_header_state') },
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          }
        ],
        nls.localize(`table_title_deployed_source`)
      );
    } else {
      output = table.createTable(
        rowsWithRelativePaths.filter(row => row.error),
        [
          {
            key: 'filePath',
            label: nls.localize('table_header_project_path')
          },
          { key: 'error', label: nls.localize('table_header_errors') }
        ],
        nls.localize(`table_title_deploy_errors`)
      );
    }

    return output;
  }
}
