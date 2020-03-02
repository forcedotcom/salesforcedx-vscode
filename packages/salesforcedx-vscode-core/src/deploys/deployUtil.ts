/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// what other parameters would be necessary
export interface FilePathOpts {
  filepath: string;
  wait?: string;
}

export interface ManifestOpts {
  manifestPath: string;
  wait: string;
}

export interface DirectoryOpts {
  directory: string;
  wait: string;
}

export interface ToolingCreateResult {
  id: string;
  success: boolean;
  errors: string[];
  name: string;
  message: string;
}

export interface ToolingRetrieveResult {
  State: string;
  ErrorMsg?: string;
  isDeleted: string;
  DeployDetails: DeployDetailsResult;
  outboundFiles?: string[];
}

export interface DeployDetailsResult {
  componentFailures: DeployResult[];
  componentSuccesses: DeployResult[];
}

export interface DeployResult {
  columnNumber?: string;
  lineNumber?: string;
  problem?: string;
  problemType?: string;
  fileName?: string;
  fullName?: string;
  componentType: string;
  success?: string;
}
