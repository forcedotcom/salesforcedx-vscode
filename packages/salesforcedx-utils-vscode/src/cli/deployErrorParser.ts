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

export interface DeploySuccess {
  state: string;
  fullName: string;
  type: string;
  filePath: string;
}

export interface ForceSourceDeployErrorResult {
  message: string;
  name: string;
  result: DeployError[];
  stack: string;
  status: number;
  warnings: any[];
  partialSuccess?: DeploySuccess[];
}

export interface ForceSourceDeploySuccessResult {
  status: number;
  result: {
    deployedSource: DeploySuccess[]
  };
}

export class ForceDeployErrorParser {
  private result: any;

  constructor(stdOut: string) {
    const stdErrLines = stdOut.split(require('os').EOL);
    for (const line of stdErrLines) {
      if (line.trim().startsWith('{')) {
        this.result = JSON.parse(line);
        return;
      }
    }
    throw new Error('No JSON found in response');
  }

  // public parse(stdErr: string) {
  //   return this.getDeployResultData(stdErr);
  // }

  public getErrors(): ForceSourceDeployErrorResult | undefined {
    if (this.result.status === 1) {
      return this.result as ForceSourceDeployErrorResult;
    }
  }

  public getSuccesses(): ForceSourceDeploySuccessResult | undefined {
    if (this.result.status === 0) {
      return this.result as ForceSourceDeploySuccessResult;
    }
  }

  // private getDeployResultData(stdErr: string): ForceSourceDeployResults {
  //   const stdErrLines = stdErr.split(require('os').EOL);
  //   for (const line of stdErrLines) {
  //     if (line.trim().startsWith('{')) {
  //       const result = JSON.parse(line);
  //       if (result.status === 0) {
  //         return {
  //           successes: result.deployedSource as DeployResult[]
  //         };
  //       }

  //       if (result instanceof Array) {
  //         return {
  //           successes: partialSuccess as DeployResult[],
  //           errors: result as DeployResult
  //         }
  //       }
  //       return {
  //         successes: result.
  //       }
  //       // return JSON.parse(line) as ForceSourceDeployErrorResult;
  //     }
  //   }
  //   throw new Error('No JSON found in response');
  // }
}
