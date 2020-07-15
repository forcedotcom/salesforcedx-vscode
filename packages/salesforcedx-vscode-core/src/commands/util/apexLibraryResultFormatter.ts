/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { nls } from '../../messages';

export function formatExecuteResult(
  execAnonResponse: ExecuteAnonymousResponse
): string {
  let outputText: string = '';
  if (execAnonResponse.result.compiled === true) {
    outputText += `${nls.localize('apex_execute_compile_success')}\n`;
    if (execAnonResponse.result.success === true) {
      outputText += `${nls.localize('apex_execute_runtime_success')}\n`;
    } else {
      outputText += `Error: ${execAnonResponse.result.exceptionMessage}\n`;
      outputText += `Error: ${execAnonResponse.result.exceptionStackTrace}\n`;
    }
    outputText += `\n${execAnonResponse.result.logs}`;
  } else {
    outputText += `Error: Line: ${execAnonResponse.result.line}, Column: ${
      execAnonResponse.result.column
    }\n`;
    outputText += `Error: ${execAnonResponse.result.compileProblem}\n`;
  }
  return outputText;
}
