/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJsonObject } from '../../helpers';

export const CONFLICT_ERROR_NAME = 'sourceConflictDetected';

export interface ProjectDeployStartResult {
  columnNumber?: string;
  error?: string;
  filePath: string;
  fullName?: string;
  lineNumber?: string;
  state?: string;
  type: string;
}

export interface ProjectDeployStartErrorResponse {
  message: string;
  name: string;
  data: ProjectDeployStartResult[];
  stack: string;
  status: number;
  warnings: any[];
}

export interface ProjectDeployStartSuccessResponse {
  status: number;
  result: {
    files: ProjectDeployStartResult[];
  };
}

export class ProjectDeployStartResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      this.response = extractJsonObject(stdout);
    } catch (e) {
      const err = new Error('Error parsing project deploy start result');
      err.name = 'ProjectDeployStartParserFail';
      throw err;
    }
  }

  public getErrors(): ProjectDeployStartErrorResponse | undefined {
    if (this.response.status === 1) {
      return this.response as ProjectDeployStartErrorResponse;
    }
  }

  public getSuccesses(): ProjectDeployStartSuccessResponse | undefined {
    const { status, result, partialSuccess } = this.response;
    if (status === 0) {
      const { pushedSource } = result;
      if (pushedSource) {
        return { status, result: { files: pushedSource } };
      }
      return this.response as ProjectDeployStartSuccessResponse;
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
