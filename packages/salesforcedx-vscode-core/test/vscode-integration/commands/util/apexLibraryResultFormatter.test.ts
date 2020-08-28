/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { formatExecuteResult } from '../../../../src/commands/util/apexLibraryResultFormatter';
import { nls } from '../../../../src/messages';

describe('Format Execute Anonymous Response', () => {
  it('should format result correctly for a successful execution', async () => {
    const execAnonResponse = {
      compiled: true,
      success: true,
      logs:
        '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n',
      diagnostic: [
        {
          lineNumber: -1,
          columnNumber: -1,
          compileProblem: '',
          exceptionMessage: '',
          exceptionStackTrace: ''
        }
      ]
    };
    const formattedResponse = `${nls.localize(
      'apex_execute_compile_success'
    )}\n${nls.localize('apex_execute_runtime_success')}\n\n${
      execAnonResponse.logs
    }`;
    const result = formatExecuteResult(execAnonResponse);
    expect(result).to.equal(formattedResponse);
  });

  it('should format result correctly for a compilation failure', async () => {
    const execAnonResult = {
      compiled: false,
      success: false,
      logs: '',
      diagnostic: [
        {
          columnNumber: 1,
          lineNumber: 6,
          compileProblem: `Unexpected token '('.`,
          exceptionMessage: '',
          exceptionStackTrace: ''
        }
      ]
    };
    const formattedResponse = `Error: Line: ${
      execAnonResult.diagnostic[0].lineNumber
    }, Column: ${execAnonResult.diagnostic[0].columnNumber}\nError: ${
      execAnonResult.diagnostic[0].compileProblem
    }\n`;

    const result = formatExecuteResult(execAnonResult);
    expect(result).to.equal(formattedResponse);
  });

  it('should format result correctly for a runtime failure', async () => {
    const execAnonResult = {
      compiled: true,
      success: false,
      logs:
        '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n',
      diagnostic: [
        {
          columnNumber: 1,
          lineNumber: 6,
          compileProblem: '',
          exceptionMessage: 'System.AssertException: Assertion Failed',
          exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
        }
      ]
    };
    const formattedResponse = `${nls.localize(
      'apex_execute_compile_success'
    )}\nError: ${execAnonResult.diagnostic[0].exceptionMessage}\nError: ${
      execAnonResult.diagnostic[0].exceptionStackTrace
    }\n\n${execAnonResult.logs}`;

    const result = formatExecuteResult(execAnonResult);
    expect(result).to.equal(formattedResponse);
  });
});
