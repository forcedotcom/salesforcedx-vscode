/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJsonObject } from '../../helpers';

export const CONFLICT_ERROR_NAME = 'sourceConflictDetected';

export interface PushResult {
  columnNumber?: string;
  error?: string;
  filePath: string;
  fullName?: string;
  lineNumber?: string;
  state?: string;
  type: string;
}

export interface ForceSourcePushErrorResponse {
  message: string;
  name: string;
  data: PushResult[];
  stack: string;
  status: number;
  warnings: any[];
}

export interface ForceSourcePushSuccessResponse {
  status: number;
  result: {
    files: PushResult[];
  };
}

export class ForcePushResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      this.response = extractJsonObject(stdout);
    } catch (e) {
      const err = new Error('Error parsing push result');
      err.name = 'PushParserFail';
      throw err;
    }
  }

  public getErrors(): ForceSourcePushErrorResponse | undefined {
    if (this.response.status === 1) {
      return this.response as ForceSourcePushErrorResponse;
    }
  }

  public getSuccesses(): ForceSourcePushSuccessResponse | undefined {
    const { status, result, partialSuccess } = this.response;
    if (status === 0) {
      const { pushedSource } = result;
      if (pushedSource) {
        return { status, result: { files: pushedSource } };
      }
      return this.response as ForceSourcePushSuccessResponse;
    }
    if (partialSuccess) {
      return { status, result: { files: partialSuccess } };
    }
  }

  public hasConflicts(): boolean {
    return (
      this.response.status === 1 && this.response.name === CONFLICT_ERROR_NAME
    );
  }
}
