/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
// tslint:disable-next-line:no-var-requires
const fs = require('fs').promises;
import {
  ApexLibraryExecuteExecutor,
  CreateApexTempFile,
  formatResult
} from '../../../src/commands/forceApexExecute';
import { getRootWorkspacePath } from '../../../src/util';

import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
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
    const result = formatResult(execAnonResponse);
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

    const result = formatResult(execAnonResult);
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

    const result = formatResult(execAnonResult);
    expect(result).to.equal(formattedResponse);
  });
});

describe('CreateApexTempFile', async () => {
  let sb: SinonSandbox;
  let fsStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    fsStub = sb.stub(fs, 'writeFile');
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should use the selected file to execute anonymous apex', async () => {
    const fileName = path.join(
      getRootWorkspacePath(),
      '.sfdx',
      'tools',
      'tempApex.input'
    );
    const mockActiveTextEditor = {
      document: {
        uri: 'file/path/to/anonApex',
        getText: (doc: { isEmpty: boolean; text: string }) => doc.text
      },
      revealRange: (
        range: vscode.Range,
        revealType?: vscode.TextEditorRevealType
      ) => {},
      selection: { isEmpty: false, text: 'System.assert(true);' }
    };
    sb.stub(vscode.window, 'activeTextEditor').get(() => {
      return mockActiveTextEditor;
    });

    const fileNameGatherer = new CreateApexTempFile();
    const result = (await fileNameGatherer.gather()) as ContinueResponse<{
      fileName: string;
    }>;
    expect(fsStub.called).to.be.true;
    expect(result.data.fileName).to.equal(fileName);
  });

  it(`should use the currently highlighted 'selection' to execute anonymous apex`, async () => {
    const filePath = 'file/path/to/anonApex';
    const mockActiveTextEditor = {
      document: {
        uri: { fsPath: filePath },
        getText: (doc: { isEmpty: boolean; text: string }) => doc.text
      },
      selection: { isEmpty: true, text: 'System.assert(true);' }
    };
    const activeTextEditorStub = sb
      .stub(vscode.window, 'activeTextEditor')
      .get(() => {
        return mockActiveTextEditor;
      });

    const fileNameGatherer = new CreateApexTempFile();
    const result = (await fileNameGatherer.gather()) as ContinueResponse<{
      fileName: string;
    }>;
    expect(fsStub.called).to.be.false;
    expect(result.data.fileName).to.equal(filePath);
  });
});
