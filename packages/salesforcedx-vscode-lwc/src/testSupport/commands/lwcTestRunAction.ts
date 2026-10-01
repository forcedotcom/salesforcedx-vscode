/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getLwcTestController } from '../testExplorer/lwcTestController';
import { TestExecutionInfo } from '../types';

/** Run an individual test case (code lens). */
export const lwcTestCaseRun = (data: { testExecutionInfo: TestExecutionInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, false);

/** Run a test file (command palette / test explorer node). */
export const lwcTestFileRun = (data: { testExecutionInfo: TestExecutionInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, false);

/** Run the test of the currently focused editor (editor-title play button). */
export const lwcTestRunActiveTextEditorTest = () => getLwcTestController().runActiveEditorFile(false);
