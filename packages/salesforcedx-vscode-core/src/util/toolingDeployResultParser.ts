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
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { DeployResult, ToolingRetrieveResult } from '../deploys';
import { nls } from '../messages';

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
}
