/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJson } from '../../helpers';

const CONFLICT_ERROR_NAME = 'SourceConflictError';

export type ProjectRetrieveStartResult = {
  columnNumber?: string;
  error?: string;
  filePath: string;
  fullName?: string;
  lineNumber?: string;
  state?: string;
  type: string;
};

export type ProjectRetrieveStartErrorResponse = {
  message: string;
  name: string;
  status: number;
  files?: ProjectRetrieveStartResult[];
  warnings: any[];
};

export type ProjectRetrieveStartSuccessResponse = {
  status: number;
  result: {
    files: ProjectRetrieveStartResult[];
  };
};

export class ProjectRetrieveStartResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      this.response = extractJson(stdout);
    } catch {
      const err = new Error('Error parsing pull result');
      err.name = 'ProjectRetrieveStartParserFail';
      throw err;
    }
  }

  public getErrors(): ProjectRetrieveStartErrorResponse | undefined {
    if (this.response.status === 1) {
      const files = this.response.data ?? this.response.result?.files;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return {
        message: this.response.message ?? 'Pull failed. ',
        name: this.response.name ?? 'RetrieveFailed',
        status: this.response.status,
        ...(files && {
          files: files.filter((file: { state: string }) => file.state === 'Failed' || file.state === 'Conflict')
        })
      } as ProjectRetrieveStartErrorResponse;
    }
  }

  public getSuccesses(): ProjectRetrieveStartSuccessResponse | undefined {
    const { status, result, partialSuccess } = this.response;
    if (status === 0) {
      const { pulledSource } = result;
      if (pulledSource) {
        return { status, result: { files: pulledSource } };
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return this.response as ProjectRetrieveStartSuccessResponse;
    }
    if (partialSuccess) {
      return { status, result: { files: partialSuccess } };
    }
  }

  public hasConflicts(): boolean {
    return this.response.status === 1 && this.response.name === CONFLICT_ERROR_NAME;
  }
}
