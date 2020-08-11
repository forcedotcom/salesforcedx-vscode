/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import {
  DeployStatus,
  SourceDeployResult,
  ToolingDeployStatus
} from '@salesforce/source-deploy-retrieve';
import { nls } from '../../messages';

type ComponentSuccess = {
  state: string;
  fullName: string;
  type: string;
  filePath: string;
};

type ComponentFailure = {
  filePath?: string;
  error: string;
};

export class LibraryDeployResultParser {
  public result: SourceDeployResult;

  constructor(deployResult: SourceDeployResult) {
    this.result = deployResult;
  }

  public resultParser(result: SourceDeployResult) {
    let outputResult: ComponentSuccess[] | ComponentFailure[];
    let formatResult: string;
    let table = new Table();
    switch (result.status) {
      case DeployStatus.Succeeded:
      case ToolingDeployStatus.Completed:
        table = new Table();
        outputResult = this.buildSuccesses(result);
        formatResult = table.createTable(
          (outputResult as unknown) as Row[],
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
        break;
      case ToolingDeployStatus.Error:
      case DeployStatus.Failed:
      case ToolingDeployStatus.Failed:
        table = new Table();
        outputResult = this.buildErrors(result);
        formatResult = table.createTable(
          (outputResult as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );
        break;
      case ToolingDeployStatus.Queued:
      case DeployStatus.Pending:
      case DeployStatus.InProgress:
        formatResult = nls.localize('beta_tapi_queue_status');
        break;
      default:
        formatResult = '';
    }
    return formatResult;
  }

  private buildSuccesses(result: SourceDeployResult) {
    let success: ComponentSuccess[] = [];
    const { components: deployments } = result;

    if (deployments) {
      for (const deployment of deployments) {
        const { component } = deployment;
        const listOfFiles = [...component.walkContent(), component.xml];
        success = listOfFiles.map(file => ({
          state: deployment.status,
          fullName: component.fullName,
          type: component.type.name,
          filePath: file
        }));
      }
    }

    return success;
  }

  private buildErrors(result: SourceDeployResult) {
    const failures: ComponentFailure[] = [];

    const { components: deployments } = result;
    if (deployments) {
      for (const deployment of deployments) {
        for (const diagnostic of deployment.diagnostics) {
          const { filePath, message, lineNumber, columnNumber } = diagnostic;
          const row: ComponentFailure = {
            error: message,
            filePath: filePath || ''
          };
          if (filePath && columnNumber && lineNumber) {
            row.error += ` (${lineNumber}:${columnNumber})`;
          }
          failures.push(row);
        }
      }
    }

    return failures;
  }
}
