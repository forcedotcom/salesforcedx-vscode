/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const startPos = new vscode.Position(0, 0);
const endPos = new vscode.Position(0, 1);
export const APEX_GROUP_RANGE = new vscode.Range(startPos, endPos);

export const PASS_RESULT = 'Pass';
export const FAIL_RESULT = 'Fail';
export const SKIP_RESULT = 'Skip';

export const APEX_TESTS = 'ApexTests';
export const APEX_CLASS_EXT = '.cls';
export const APEX_TESTSUITE_EXT = '.testSuite-meta.xml';
export const IS_TEST_REG_EXP = /@isTest/i;

// Test item ID prefixes
export const TEST_ID_PREFIXES = {
  SUITE: 'suite:',
  CLASS: 'class:',
  METHOD: 'method:',
  SUITE_CLASS: 'suite-class:'
} as const;

export const SUITE_PARENT_ID = 'apex-test-suites-parent';
