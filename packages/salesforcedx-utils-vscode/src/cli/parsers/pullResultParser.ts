/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJsonObject } from '../../helpers';

export const CONFLICT_ERROR_NAME = 'sourceConflictDetected';

export interface PullResult {
  columnNumber?: string;
  error?: string;
  filePath: string;
  fullName?: string;
  lineNumber?: string;
  state?: string;
  type: string;
}

export interface ForceSourcePullErrorResponse {
  message: string;
  name: string;
  data: PullResult[];
  stack: string;
  status: number;
  warnings: any[];
}

export interface ForceSourcePullSuccessResponse {
  status: number;
  result: {
    pulledSource: PullResult[];
  };
}

export class ForcePullResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      this.response = extractJsonObject(stdout);
    } catch (e) {
      const err = new Error('Error parsing pull result');
      err.name = 'PullParserFail';
      throw err;
    }
  }

  public getErrors(): ForceSourcePullErrorResponse | undefined {
    if (this.response.status === 1) {
      return this.response as ForceSourcePullErrorResponse;
    }
  }

  public getSuccesses(): ForceSourcePullSuccessResponse | undefined {
    const { status, result, partialSuccess } = this.response;
    if (status === 0) {
      const { pulledSource } = result;
      if (pulledSource) {
        return { status, result: { pulledSource } };
      }
      return this.response as ForceSourcePullSuccessResponse;
    }
    if (partialSuccess) {
      return { status, result: { pulledSource: partialSuccess } };
    }
  }

  public hasConflicts(): boolean {
    return (
      this.response.status === 1 && this.response.name === CONFLICT_ERROR_NAME
    );
  }
}
