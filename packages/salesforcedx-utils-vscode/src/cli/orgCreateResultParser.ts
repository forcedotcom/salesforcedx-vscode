/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJsonObject } from '../helpers';

export type OrgCreateSuccessResult = {
  status: number;
  result: {
    orgId: string;
    username: string;
  };
};

export type OrgCreateErrorResult = {
  status: number;
  name: string;
  message: string;
  exitCode: number;
  commandName: string;
  stack: string;
  warnings: any[];
};

export class OrgCreateResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      if (stdout) {
        this.response = extractJsonObject(stdout);
      }
    } catch (e) {
      const err = new Error('Error parsing org create result');
      err.name = 'OrgCreateParserFail';
      throw err;
    }
  }

  public createIsSuccessful(): boolean {
    return this.response && this.response.status === 0 ? true : false;
  }

  public getResult(): OrgCreateSuccessResult | OrgCreateErrorResult {
    if (this.createIsSuccessful()) {
      return this.response as OrgCreateSuccessResult;
    }
    return this.response as OrgCreateErrorResult;
  }
}
