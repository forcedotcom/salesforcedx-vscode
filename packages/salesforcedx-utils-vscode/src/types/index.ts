/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Precondition checking
////////////////////////
export interface PreconditionChecker {
  check(): Promise<boolean> | boolean;
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
  /**
   * Name of the component (FullName in the API)
   */
  fileName: string;

  /**
   * Relative workspace path to save the component
   */
  outputdir: string;
};

/**
 * Representation of a metadata component to be written to the local workspace
 */
export type LocalComponent = DirFileNameSelection & {
  /**
   * The component's metadata type
   */
  type: string;

  /**
   * Optional suffix to overwrite in case metadata dictionary does not have it
   */
  suffix?: string;
};
