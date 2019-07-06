/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface ScratchOrgCreateSuccessResult {
  status: number;
  result: {
    orgId: string;
    username: string;
  };
}

export interface ScratchOrgCreateErrorResult {
  status: number;
  name: string;
  message: string;
  exitCode: number;
  commandName: string;
  stack: string;
  warnings: any[];
}

export class ScratchOrgCreateResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      const sanitized = stdout.substring(
        stdout.indexOf('{'),
        stdout.lastIndexOf('}') + 1
      );
      this.response = JSON.parse(sanitized);
    } catch (e) {
      const err = new Error('Error parsing scratch org create result');
      err.name = 'ScratchOrgCreateParserFail';
      throw err;
    }
  }

  public createIsSuccessful(): boolean {
    return this.response && this.response.status === 0 ? true : false;
  }

  public getResult():
    | ScratchOrgCreateSuccessResult
    | ScratchOrgCreateErrorResult {
    if (this.createIsSuccessful()) {
      return this.response as ScratchOrgCreateSuccessResult;
    }
    return this.response as ScratchOrgCreateErrorResult;
  }
}
