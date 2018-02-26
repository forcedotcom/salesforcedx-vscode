/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Precondition checking
////////////////////////
export interface PreconditionChecker {
  check(): boolean;
}

export interface PostconditionChecker<T> {
  check(
    inputs: ContinueResponse<T> | CancelResponse
  ): Promise<ContinueResponse<T> | CancelResponse>;
}

// Input gathering
//////////////////
export interface ContinueResponse<T> {
  type: 'CONTINUE';
  data: T;
}

export interface CancelResponse {
  type: 'CANCEL';
  msg?: string;
}

export interface ParametersGatherer<T> {
  gather(): Promise<CancelResponse | ContinueResponse<T>>;
}

// Selection
////////////

export type DirFileNameSelection = {
  fileName: string;
  outputdir: string;
};
