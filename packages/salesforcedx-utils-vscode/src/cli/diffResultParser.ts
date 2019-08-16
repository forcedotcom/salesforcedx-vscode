/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJsonObject } from '../helpers';

export interface DiffSuccessResponse {
  status: number;
  result: {
    remote: string;
    local: string;
    fileName: string;
  };
}

export interface DiffErrorResponse {
  commandName: string;
  exitCode: number;
  message: string;
  name: string;
  stack: string;
  status: number;
  warnings: any[];
}

export class DiffResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      this.response = extractJsonObject(stdout);
    } catch (e) {
      const err = new Error('Error parsing diff result');
      err.name = 'DiffResultParserFail';
      throw err;
    }
  }

  public isSuccessful(): boolean {
    return this.response && this.response.status === 0 ? true : false;
  }

  public getSuccessResponse(): DiffSuccessResponse | undefined {
    if (this.isSuccessful()) {
      return this.response as DiffSuccessResponse;
    }
  }

  public getErrorResponse(): DiffErrorResponse | undefined {
    if (!this.isSuccessful()) {
      return this.response as DiffErrorResponse;
    }
  }
}
