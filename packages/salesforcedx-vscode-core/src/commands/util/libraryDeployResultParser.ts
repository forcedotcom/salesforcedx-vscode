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
  DeployResult,
  DeployStatusEnum,
  SourceResult
} from '@salesforce/source-deploy-retrieve';
import { nls } from '../../messages';
type ComponentSuccess = {
  state: string;
  fullName: string;
  type: string;
  filePath: string;
};
export class LibraryDeployResultParser {
  public result: DeployResult;

  constructor(deployResult: DeployResult) {
    this.result = deployResult;
  }

  public buildSuccesses(componentSuccess: SourceResult) {
    const mdState =
      componentSuccess.changed && !componentSuccess.created
        ? 'Updated'
        : 'Created';
    const listOfFiles = this.result.outboundFiles;
    let success: ComponentSuccess[] = [];
    if (listOfFiles) {
      success = listOfFiles.map(file => ({
        state: mdState,
        fullName: componentSuccess.fullName!,
        type: componentSuccess.componentType,
        filePath: file
      }));
    }
    return success;
  }

  public buildErrors(result: DeployResult) {
    const failures = [];
    if (
      result.DeployDetails &&
      result.DeployDetails.componentFailures.length > 0
    ) {
      for (const err of result.DeployDetails.componentFailures) {
        if (err.columnNumber && err.lineNumber) {
          err.problem = `${err.problem} (${err.lineNumber}:${
            err.columnNumber
          })`;
        }
        failures.push({
          filePath: err.fileName,
          error: err.problem
        });
      }
    } else if (result.outboundFiles) {
      for (const outboundFile of result.outboundFiles) {
        failures.push({
          filePath: outboundFile, // might want to format this to only the name of the file vs fullpath
          error: result.ErrorMsg
        });
      }
    }

    return failures;
  }

  public async outputResult(sourceUri?: string): Promise<string> {
    let outputResult: string;
    const table = new Table();
    let title: string;
    switch (this.result.State) {
      case DeployStatusEnum.Completed:
        title = nls.localize(`table_title_deployed_source`);
        const successRows = this.buildSuccesses(
          this.result.DeployDetails!.componentSuccesses[0]
        );
        outputResult = table.createTable(
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
        break;
      case DeployStatusEnum.Failed:
        const failedErrorRows = this.buildErrors(this.result);
        outputResult = table.createTable(
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
        break;
      case DeployStatusEnum.Queued:
        outputResult = nls.localize('beta_tapi_queue_status');
        break;
      case DeployStatusEnum.Error:
        const error = this.result.ErrorMsg!;
        const errorRows = [{ filePath: sourceUri, error }];
        outputResult = table.createTable(
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
        break;
      default:
        outputResult = '';
    }
    return outputResult;
  }
}
