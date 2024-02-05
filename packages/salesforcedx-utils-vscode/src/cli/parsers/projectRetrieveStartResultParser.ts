/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJsonObject } from '../../helpers';

export const CONFLICT_ERROR_NAME = 'SourceConflictError';

export interface PullResult {
  columnNumber?: string;
  error?: string;
  filePath: string;
  fullName?: string;
  lineNumber?: string;
  state?: string;
  type: string;
}

export interface ProjectRetrieveStartErrorResponse {
  message: string;
  name: string;
  data: PullResult[];
  stack: string;
  status: number;
  warnings: any[];
}

export interface ProjectRetrieveStartSuccessResponse {
  status: number;
  result: {
    files: PullResult[];
  };
}

export class ProjectRetrieveStartResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      this.response = extractJsonObject(stdout);
    } catch (e) {
      const err = new Error('Error parsing pull result');
      err.name = 'ProjectRetrieveStartParserFail';
      throw err;
    }
  }

  public getErrors(): ProjectRetrieveStartErrorResponse | undefined {
    if (this.response.status === 1) {
      return this.response as ProjectRetrieveStartErrorResponse;
    }
  }

  public getSuccesses(): ProjectRetrieveStartSuccessResponse | undefined {
    const { status, result, partialSuccess } = this.response;
    if (status === 0) {
      const { pulledSource } = result;
      if (pulledSource) {
        return { status, result: { files: pulledSource } };
      }
      return this.response as ProjectRetrieveStartSuccessResponse;
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
