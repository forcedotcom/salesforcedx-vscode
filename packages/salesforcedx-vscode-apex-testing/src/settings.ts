/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const APEX_TESTING_CONFIGURATION_NAME = 'salesforcedx-vscode-apex-testing';

export const retrieveTestCodeCoverage = (): boolean =>
  vscode.workspace.getConfiguration(APEX_TESTING_CONFIGURATION_NAME).get<boolean>('retrieve-test-code-coverage', false);

export const retrieveTestRunConcise = (): boolean =>
  vscode.workspace.getConfiguration(APEX_TESTING_CONFIGURATION_NAME).get<boolean>('test-run-concise', false);

export const retrieveOutputFormat = (): 'markdown' | 'text' =>
  vscode.workspace
    .getConfiguration(APEX_TESTING_CONFIGURATION_NAME)
    .get<'markdown' | 'text'>('outputFormat', 'markdown');

export const retrieveTestSortOrder = (): 'runtime' | 'coverage' | 'severity' =>
  vscode.workspace
    .getConfiguration(APEX_TESTING_CONFIGURATION_NAME)
    .get<'runtime' | 'coverage' | 'severity'>('testSortOrder', 'runtime');

export const retrievePerformanceThreshold = (): number =>
  vscode.workspace.getConfiguration(APEX_TESTING_CONFIGURATION_NAME).get<number>('testPerformanceThresholdMs', 5000);

export const retrieveCoverageThreshold = (): number =>
  vscode.workspace.getConfiguration(APEX_TESTING_CONFIGURATION_NAME).get<number>('testCoverageThresholdPercent', 75);
