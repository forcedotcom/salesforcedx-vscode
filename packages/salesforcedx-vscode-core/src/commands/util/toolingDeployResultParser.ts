/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CompositeCliCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { channelService } from '../../channels';
import {
  DeployResult,
  DeployStatusEnum,
  ToolingRetrieveResult
} from '../../deploys';
import { nls } from '../../messages';

export class ToolingDeployParser {
  public result: ToolingRetrieveResult;

  constructor(deployResult: ToolingRetrieveResult) {
    this.result = deployResult;
  }

  public buildSuccesses(componentSuccess: DeployResult) {
    const success = [
      {
        state: 'Add',
        fullName: componentSuccess.fullName,
        type: componentSuccess.componentType,
        filePath: componentSuccess.fileName
      },
      {
        state: 'Add',
        fullName: componentSuccess.fullName,
        type: componentSuccess.componentType,
        filePath: `${componentSuccess.fileName}-meta.xml`
      }
    ];
    return success;
  }

  public buildErrors(componentErrors: DeployResult[]) {
    const failures = [];
    for (const err of componentErrors) {
      if (err.columnNumber && err.lineNumber) {
        err.problem = `${err.problem} (${err.lineNumber}:${err.columnNumber})`;
      }
      failures.push({
        filePath: err.fileName,
        error: err.problem
      });
    }
    return failures;
  }

  public async outputResult(
    executionWrapper: CompositeCliCommandExecution,
    sourceUri?: string
  ) {
    const table = new Table();
    let title: string;
    switch (this.result.State) {
      case DeployStatusEnum.Completed:
        title = nls.localize(`table_title_deployed_source`);
        const successRows = this.buildSuccesses(
          this.result.DeployDetails.componentSuccesses[0]
        );
        const successTable = table.createTable(
          (successRows as unknown) as Row[],
          [
            { key: 'state', label: nls.localize('table_header_state') },
            { key: 'fullName', label: nls.localize('table_header_full_name') },
            { key: 'type', label: nls.localize('table_header_type') },
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            }
          ],
          title
        );
        channelService.appendLine(successTable);
        executionWrapper.successfulExit();
        break;
      case DeployStatusEnum.Failed:
        const failedErrorRows = this.buildErrors(
          this.result.DeployDetails.componentFailures
        );
        const failedErrorTable = table.createTable(
          (failedErrorRows as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );
        channelService.appendLine(failedErrorTable);
        executionWrapper.failureExit();
        break;
      case DeployStatusEnum.Queued:
        const queueError = nls.localize('beta_tapi_queue_status');
        channelService.appendLine(queueError);
        executionWrapper.failureExit();
        break;
      case DeployStatusEnum.Error:
        const error = this.result.ErrorMsg!;
        const errorRows = [{ filePath: sourceUri, error }];
        const errorTable = table.createTable(
          (errorRows as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );
        channelService.appendLine(errorTable);
        executionWrapper.failureExit();
        break;
    }
  }
}
