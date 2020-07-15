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
      result: {
        compiled: true,
        success: true,
        exceptionMessage: '',
        exceptionStackTrace: '',
        line: -1,
        column: -1,
        compileProblem: '',
        logs:
          '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n'
      }
    };
    const formattedResponse = `${nls.localize(
      'apex_execute_compile_success'
    )}\n${nls.localize('apex_execute_runtime_success')}\n\n${
      execAnonResponse.result.logs
    }`;
    const result = formatExecuteResult(execAnonResponse);
    expect(result).to.equal(formattedResponse);
  });

  it('should format result correctly for a compilation failure', async () => {
    const execAnonResult = {
      result: {
        column: 1,
        line: 6,
        compiled: false,
        compileProblem: `Unexpected token '('.`,
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: false,
        logs: ''
      }
    };
    const formattedResponse = `Error: Line: ${
      execAnonResult.result.line
    }, Column: ${execAnonResult.result.column}\nError: ${
      execAnonResult.result.compileProblem
    }\n`;

    const result = formatExecuteResult(execAnonResult);
    expect(result).to.equal(formattedResponse);
  });

  it('should format result correctly for a runtime failure', async () => {
    const execAnonResult = {
      result: {
        column: 1,
        line: 6,
        compiled: true,
        compileProblem: '',
        exceptionMessage: 'System.AssertException: Assertion Failed',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1',
        success: false,
        logs:
          '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n'
      }
    };
    const formattedResponse = `${nls.localize(
      'apex_execute_compile_success'
    )}\nError: ${execAnonResult.result.exceptionMessage}\nError: ${
      execAnonResult.result.exceptionStackTrace
    }\n\n${execAnonResult.result.logs}`;

    const result = formatExecuteResult(execAnonResult);
    expect(result).to.equal(formattedResponse);
  });
});
