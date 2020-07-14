/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspace } from 'vscode';
import { TestRunType } from '../testRunner/testRunner';

/**
 * Returns workspace specific jest args from CLI arguments and test run type
 * @param jestArgs jest args
 * @param testRunType test run type
 */
export function getCliArgsFromJestArgs(
  jestArgs: string[],
  testRunType: TestRunType
) {
  const cliArgs = ['--', ...jestArgs];

  const usePreviewJavaScriptDebugger = workspace
    .getConfiguration('debug')
    .get('javascript.usePreview');

  if (testRunType === TestRunType.DEBUG && !usePreviewJavaScriptDebugger) {
    cliArgs.unshift('--debug');
  }
  return cliArgs;
}
