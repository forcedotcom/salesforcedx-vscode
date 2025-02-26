/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extractJson } from '../helpers';

/**
 * Type that stores information about a successful diff operation
 */
export type DiffSuccessResponse = {
  /**
   * Request status e.g. 0 = Success
   */
  status: number;
  /**
   * Object that contains the successful result
   */
  result: {
    /**
     * Provides the location to the cached file retrieved from the org
     */
    remote: string;
    /**
     * Provides the location to the file provided by the user in --sourcepath
     */
    local: string;
    /**
     * Name of the file being diffed
     */
    fileName: string;
  };
};

/**
 * Type that stores information about an unsuccessful diff operation
 */
export type DiffErrorResponse = {
  /**
   * Name of the command that was executed e.g. Diff
   */
  commandName: string;
  /**
   * Exit code provided by the command e.g. 1
   */
  exitCode: number;
  /**
   * Error message provided by the command e.g. The path could not be found.
   */
  message: string;
  /**
   * Error name
   */
  name: string;
  /**
   * Stack trace for the current error
   */
  stack: string;
  /**
   * Request status e.g. 1 = Error
   */
  status: number;
  /**
   * Array of warnings provided by the command
   */
  warnings: any[];
};

export class DiffResultParser {
  private response: any;

  constructor(stdout: string) {
    try {
      this.response = extractJson(stdout);
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
