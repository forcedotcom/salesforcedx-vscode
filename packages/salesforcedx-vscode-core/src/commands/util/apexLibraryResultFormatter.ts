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
  let outputText = '';
  if (execAnonResponse.success) {
    outputText += `${nls.localize('apex_execute_compile_success')}\n`;
    outputText += `${nls.localize('apex_execute_runtime_success')}\n`;
    outputText += `\n${execAnonResponse.logs}`;
  } else {
    const diagnostic = execAnonResponse.diagnostic![0];

    if (!execAnonResponse.compiled) {
      outputText += `Error: Line: ${diagnostic.lineNumber}, Column: ${
        diagnostic.columnNumber
      }\n`;
      outputText += `Error: ${diagnostic.compileProblem}\n`;
    } else {
      outputText += `${nls.localize('apex_execute_compile_success')}\n`;
      outputText += `Error: ${diagnostic.exceptionMessage}\n`;
      outputText += `Error: ${diagnostic.exceptionStackTrace}\n`;
      outputText += `\n${execAnonResponse.logs}`;
    }
  }
  return outputText;
}
