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
  'https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide/java-setup.html';
const APEX_EXTENSION_NAME = 'salesforcedx-vscode-apex';
export const VSCODE_APEX_EXTENSION_NAME = `salesforce.${APEX_EXTENSION_NAME}`;
export const LSP_ERR = 'apexLSPError';

export const APEX_TESTS = 'ApexTests';
export const API = {
  doneIndexing: 'indexer/done'
};
export const UBER_JAR_NAME = 'apex-jorje-lsp.jar';
export const APEX_LSP_ORPHAN = 'apexLSPOrphan';
export const IS_TEST_REG_EXP = /@isTest/i;
export const APEX_CLASS_EXT = '.cls';
export const APEX_TESTSUITE_EXT = '.testSuite-meta.xml';
export const SF_LOG_LEVEL_SETTING = 'salesforcedx-vscode-core.SF_LOG_LEVEL';
