/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';

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
}

export interface ForceSourceDeploySuccessResult {
  status: number;
  result: {
    deployedSource: DeploySuccess[];
  };
}

export class ForceDeployResultParser {
  private response: any;

  constructor(stdOut: string) {
    const stdErrLines = stdOut.split(EOL);
    for (const line of stdErrLines) {
      if (line.trim().startsWith('{')) {
        this.response = JSON.parse(line);
        return;
      }
    }
    throw new Error('No JSON found in response');
  }

  public getErrors(): ForceSourceDeployErrorResult | undefined {
    if (this.response.status === 1) {
      return this.response as ForceSourceDeployErrorResult;
    }
  }

  public getSuccesses(): ForceSourceDeploySuccessResult | undefined {
    const { status, result, partialSuccess } = this.response;
    if (status === 0) {
      const { pushedSource } = result;
      if (pushedSource) {
        return { status, result: { deployedSource: pushedSource } };
      }
      return this.response as ForceSourceDeploySuccessResult;
    }
    if (partialSuccess) {
      return { status, result: { deployedSource: partialSuccess } };
    }
  }
}
