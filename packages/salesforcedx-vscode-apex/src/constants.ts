/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

export const DEBUGGER_LINE_BREAKPOINTS = 'debugger/lineBreakpoints';
export const DEBUGGER_EXCEPTION_BREAKPOINTS = 'debugger/exceptionBreakpoints';

const startPos = new vscode.Position(0, 0);
const endPos = new vscode.Position(0, 1);
export const APEX_GROUP_RANGE = new vscode.Range(startPos, endPos);
export const SET_JAVA_DOC_LINK =
  'https://developer.salesforce.com/tools/vscode/en/vscode-desktop/java-setup';
export const SFDX_APEX_CONFIGURATION_NAME = 'salesforcedx-vscode-apex';
export const APEX_EXTENSION_NAME = 'salesforcedx-vscode-apex';
export const VSCODE_APEX_EXTENSION_NAME = `salesforce.${APEX_EXTENSION_NAME}`;
export const LSP_ERR = 'apexLSPError';

export const PASS_RESULT = 'Pass';
export const FAIL_RESULT = 'Fail';
export const SKIP_RESULT = 'Skip';

export const APEX_TESTS = 'ApexTests';

export enum ServiceState {
  /** A service in this state is inactive. It does minimal work and consumes minimal resources. */
  NEW,

  /** A service in this state is transitioning to {@link #RUNNING}. */
  STARTING,

  /** A service in this state is operational. */
  RUNNING,

  /** A service in this state is transitioning to {@link #TERMINATED}. */
  STOPPING,

  /**
   * A service in this state has completed execution normally. It does minimal work and consumes
   * minimal resources.
   */
  TERMINATED,

  /**
   * A service in this state has encountered a problem and may not be operational. It cannot be
   * started nor stopped.
   */
  FAILED
}

export const API = {
  doneIndexing: 'indexer/done',
  indexerStatus: 'indexer/status'
};
