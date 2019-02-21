/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export interface DeployError {
  columnNumber?: string;
  error: string;
  filePath: string;
  fullName?: string;
  lineNumber?: string;
  type: string;
}

export interface ForceSourceDeployErrorResult {
  message: string;
  name: string;
  result: DeployError[];
  stack: string;
  status: number;
  warnings: any[];
}

export interface DeployResult {
  type: string;
  filePath: string;
  fullName?: string;
  state?: string;
  error?: string;
  columnNumber?: string;
  lineNumber?: string;
}

export interface ForceSourceDeployResults {
  successes?: DeployResult[];
  failures?: DeployResult[];
}

export class ForceDeployErrorParser {
  public parse(stdErr: string) {
    return this.getDeployResultData(stdErr);
  }

  private getDeployResultData(stdErr: string): ForceSourceDeployResults {
    const stdErrLines = stdErr.split(require('os').EOL);
    for (const line of stdErrLines) {
      if (line.trim().startsWith('{')) {
        const { status, result } = JSON.parse(line);
        if (status === 0) {
          return {
            successes: result.deployedSource as DeployResult[]
          };
        }
        if (result instanceof Array) {
        }
        // return JSON.parse(line) as ForceSourceDeployErrorResult;
      }
    }
    throw new Error('No JSON found in response');
  }
}
