/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';

export function getOutboundFiles(sourceUri: vscode.Uri) {
  const metadataPath = `${sourceUri.fsPath}-meta.xml`;
  return [sourceUri.fsPath, metadataPath];
}
export interface ToolingRetrieveResult {
  State: string;
  ErrorMsg?: string;
  isDeleted: string;
  DeployDetails: DeployDetailsResult;
  outboundFiles?: string[];
}
export interface DeployDetailsResult {
  componentFailures: DeployResult[];
  componentSuccesses: DeployResult[];
}

export interface DeployResult {
  columnNumber?: string;
  lineNumber?: string;
  problem?: string;
  problemType?: string;
  fileName?: string;
  fullName?: string;
  componentType: string;
  success?: string;
}

function buildSuccesses(componentSuccess: DeployResult) {
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

function buildErrors(componentErrors: DeployResult[]) {
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

export function outputResult(retrieveResult: ToolingRetrieveResult) {
  const table = new Table();
  const titleType = 'ApexClass';
  let title: string;
  const deployFailed = new Error();
  switch (retrieveResult.State) {
    case 'Completed':
      title = nls.localize(`table_title_deployed_source`);
      const successRows = buildSuccesses(
        retrieveResult.DeployDetails.componentSuccesses[0]
      );
      const successTable = table.createTable(
        (successRows as unknown) as Row[],
        [
          { key: 'state', label: nls.localize('table_header_state') },
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          { key: 'filePath', label: nls.localize('table_header_project_path') }
        ],
        title
      );
      channelService.appendLine(successTable);
      break;
    case 'Failed':
      const errorRows = buildErrors(
        retrieveResult.DeployDetails.componentFailures
      );
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
      break;
    case 'Invalidated':
    default:
  }
}
