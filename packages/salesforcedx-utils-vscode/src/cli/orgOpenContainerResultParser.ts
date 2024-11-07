/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type OrgOpenSuccessResult = {
  status: number;
  result: {
    orgId: string;
    url: string;
    username: string;
  };
};

export type OrgOpenErrorResult = {
  status: number;
  name: string;
  message: string;
  exitCode: number;
  commandName: string;
  stack: string;
  warnings: any[];
};

export class OrgOpenContainerResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      const sanitized = stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
      this.response = JSON.parse(sanitized);
    } catch (e) {
      const err = new Error('Error parsing org open result');
      err.name = 'OrgOpenContainerParserFail';
      throw err;
    }
  }

  public openIsSuccessful(): boolean {
    return this.response && this.response.status === 0 ? true : false;
  }

  public getResult(): OrgOpenSuccessResult | OrgOpenErrorResult {
    if (this.openIsSuccessful()) {
      return this.response as OrgOpenSuccessResult;
    }
    return this.response as OrgOpenErrorResult;
  }
}
