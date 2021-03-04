/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteService } from '@salesforce/apex-node';
import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import {
  AnonApexGatherer,
  ApexLibraryExecuteExecutor,
  CreateApexTempFile,
  forceApexExecute,
  ForceApexExecuteExecutor
} from '../../../src/commands/forceApexExecute';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';

const sb = createSandbox();

// tslint:disable:no-unused-expression
describe('Force Apex Execute', () => {
  beforeEach(() => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: {
        uri: vscode.Uri.file('/test')
      }
    }));
    sb.stub(workspaceContext, 'getConnection');
  });

  afterEach(() => sb.restore());

  describe('AnonApexGatherer', async () => {
    it('should return the selected file to execute anonymous apex', async () => {
      const fileName = path.join(
        getRootWorkspacePath(),
        '.sfdx',
        'tools',
        'tempApex.input'
      );
      const mockActiveTextEditor = {
        document: {
          uri: { fsPath: fileName },
          isUntitled: false
        },
        selection: { isEmpty: true }
      };

      sb.stub(vscode.window, 'activeTextEditor').get(() => {
        return mockActiveTextEditor;
      });

      const fileNameGatherer = new AnonApexGatherer();
      const result = (await fileNameGatherer.gather()) as ContinueResponse<{
        fileName: string;
      }>;
      expect(result.data.fileName).to.equal(fileName);
    });

    it('should return the text in file if file has not been created yet', async () => {
      const text = 'System.assert(true);';
      const fileName = path.join(
        getRootWorkspacePath(),
        '.sfdx',
        'tools',
        'tempApex.input'
      );
      const mockActiveTextEditor = {
        document: {
          uri: { fsPath: fileName },
          getText: () => text,
          isUntitled: true
        },
        selection: { isEmpty: true, text: 'System.assert(false);' }
      };
      sb.stub(vscode.window, 'activeTextEditor').get(() => {
        return mockActiveTextEditor;
      });

      const fileNameGatherer = new AnonApexGatherer();
      const result = (await fileNameGatherer.gather()) as ContinueResponse<{
        apexCode: string;
      }>;
      expect(result.data.apexCode).to.equal(text);
    });

    it(`should return the currently highlighted 'selection' to execute anonymous apex`, async () => {
      const mockActiveTextEditor = {
        document: {
          getText: (doc: { isEmpty: boolean; text: string }) => doc.text,
          isUntitled: true
        },
        selection: { isEmpty: false, text: 'System.assert(true);' }
      };
      sb.stub(vscode.window, 'activeTextEditor').get(() => {
        return mockActiveTextEditor;
      });

      const apexCodeGatherer = new AnonApexGatherer();
      const result = (await apexCodeGatherer.gather()) as ContinueResponse<{
        apexCode: string;
      }>;
      expect(result.data.apexCode).to.equal('System.assert(true);');
    });
  });

  describe('use CLI Command setting', async () => {
    let settingStub: SinonStub;
    let libraryExecuteStub: SinonStub;
    let cliExecuteStub: SinonStub;
    let anonGather: SinonStub;
    let apexTempFile: SinonStub;

    beforeEach(() => {
      settingStub = sb.stub().withArgs('experimental.useApexLibrary');
      sb.stub(vscode.workspace, 'getConfiguration')
        .withArgs('salesforcedx-vscode-core')
        .returns({
          get: settingStub
        });
      libraryExecuteStub = sb.stub(
        ApexLibraryExecuteExecutor.prototype,
        'execute'
      );
      cliExecuteStub = sb.stub(ForceApexExecuteExecutor.prototype, 'execute');
      anonGather = sb
        .stub(AnonApexGatherer.prototype, 'gather')
        .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);
      apexTempFile = sb
        .stub(CreateApexTempFile.prototype, 'gather')
        .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);
    });

    it('should use the ApexLibraryExecuteExecutor if setting is true', async () => {
      settingStub.returns(true);
      await forceApexExecute();
      expect(libraryExecuteStub.calledOnce).to.be.true;
      expect(anonGather.calledOnce).to.be.true;
      expect(cliExecuteStub.called).to.be.false;
      expect(apexTempFile.called).to.be.false;
    });

    it('should use the ForceApexExecuteExecutor if setting is false', async () => {
      settingStub.returns(false);
      await forceApexExecute();
      expect(cliExecuteStub.calledOnce).to.be.true;
      expect(apexTempFile.calledOnce).to.be.true;
      expect(libraryExecuteStub.called).to.be.false;
      expect(anonGather.called).to.be.false;
    });
  });

  describe('Format Execute Anonymous Response', () => {
    let outputStub: SinonStub;

    beforeEach(() => {
      outputStub = sb.stub(channelService, 'appendLine');
    });

    it('should format result correctly for a successful execution', async () => {
      const executor = new ApexLibraryExecuteExecutor();
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
      const expectedOutput = `${nls.localize(
        'apex_execute_compile_success'
      )}\n${nls.localize('apex_execute_runtime_success')}\n\n${
        execAnonResponse.logs
      }`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
        execAnonResponse
      );

      await executor.run({ type: 'CONTINUE', data: {} });

      expect(outputStub.firstCall.args[0]).to.equal(expectedOutput);
    });

    it('should format result correctly for a compilation failure', async () => {
      const executor = new ApexLibraryExecuteExecutor();
      const execAnonResponse = {
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
      const expectedOutput = `Error: Line: ${execAnonResponse.diagnostic[0].lineNumber}, Column: ${execAnonResponse.diagnostic[0].columnNumber}\nError: ${execAnonResponse.diagnostic[0].compileProblem}\n`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
        execAnonResponse
      );

      await executor.run({ type: 'CONTINUE', data: {} });

      expect(outputStub.firstCall.args[0]).to.equal(expectedOutput);
    });

    it('should format result correctly for a runtime failure', async () => {
      const executor = new ApexLibraryExecuteExecutor();
      const execAnonResponse = {
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
      const {
        exceptionMessage,
        exceptionStackTrace
      } = execAnonResponse.diagnostic[0];
      const expectedOutput = `${nls.localize(
        'apex_execute_compile_success'
      )}\nError: ${exceptionMessage}\nError: ${exceptionStackTrace}\n\n${
        execAnonResponse.logs
      }`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(
        execAnonResponse
      );

      await executor.run({ type: 'CONTINUE', data: {} });

      expect(outputStub.firstCall.args[0]).to.equal(expectedOutput);
    });
  });

  describe('Report Diagnostics', () => {
    const executor = new ApexLibraryExecuteExecutor();
    const file = '/test';
    const defaultResponse = {
      compiled: true,
      success: false,
      logs:
        '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n',
      diagnostic: [
        {
          columnNumber: '1',
          lineNumber: '6',
          compileProblem: '',
          exceptionMessage: 'System.AssertException: Assertion Failed',
          exceptionStackTrace: 'AnonymousBlock: line 6, column 1'
        }
      ]
    };

    let setDiagnosticStub: SinonStub;
    let executeStub: SinonStub;

    beforeEach(() => {
      setDiagnosticStub = sb.stub(
        ApexLibraryExecuteExecutor.diagnostics,
        'set'
      );
      executeStub = sb
        .stub(ExecuteService.prototype, 'executeAnonymous')
        .resolves(defaultResponse);
    });

    it('should clear diagnostics before setting new ones', async () => {
      const clearStub = sb.stub(
        ApexLibraryExecuteExecutor.diagnostics,
        'clear'
      );

      await executor.run({ data: { fileName: file }, type: 'CONTINUE' });

      expect(clearStub.calledBefore(setDiagnosticStub)).to.be.true;
    });

    it('should report diagnostic with zero based range', async () => {
      const expectedDiagnostic = {
        message: defaultResponse.diagnostic[0].exceptionMessage,
        severity: vscode.DiagnosticSeverity.Error,
        source: file,
        range: new vscode.Range(5, 0, 5, 0)
      };

      await executor.run({ data: { fileName: file }, type: 'CONTINUE' });

      expect(setDiagnosticStub.calledOnce).to.be.true;
      expect(setDiagnosticStub.firstCall.args[0].path).to.deep.equal(file);
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([
        expectedDiagnostic
      ]);
    });

    it('should set compile problem as message if present', async () => {
      const response = Object.assign({}, defaultResponse, {
        diagnostic: [
          {
            columnNumber: 1,
            lineNumber: 6,
            compileProblem: 'An error happened while compiling',
            exceptionMessage: '',
            exceptionStackTrace: 'AnonymousBlock: line 6, column 1'
          }
        ]
      });
      const expectedDiagnostic = {
        message: response.diagnostic[0].compileProblem,
        severity: vscode.DiagnosticSeverity.Error,
        source: file,
        range: new vscode.Range(5, 0, 5, 0)
      };
      executeStub.resolves(response);

      await executor.run({ data: { fileName: file }, type: 'CONTINUE' });

      expect(setDiagnosticStub.calledOnce).to.be.true;
      expect(setDiagnosticStub.firstCall.args[0].path).to.deep.equal(file);
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([
        expectedDiagnostic
      ]);
    });

    it('should set exception message as message if compile problem not present', async () => {
      const response = Object.assign({}, defaultResponse, {
        diagnostic: [
          {
            columnNumber: 1,
            lineNumber: 6,
            exceptionMessage: 'System.AssertException: Assertion Failed',
            exceptionStackTrace: 'AnonymousBlock: line 6, column 1'
          }
        ]
      });
      executeStub.resolves(response);
      const expectedDiagnostic = {
        message: response.diagnostic[0].exceptionMessage,
        severity: vscode.DiagnosticSeverity.Error,
        source: file,
        range: new vscode.Range(5, 0, 5, 0)
      };

      await executor.run({ data: { fileName: file }, type: 'CONTINUE' });

      expect(setDiagnosticStub.calledOnce).to.be.true;
      expect(setDiagnosticStub.firstCall.args[0].path).to.deep.equal(file);
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([
        expectedDiagnostic
      ]);
    });

    it('should set exception message as message if compile problem empty string', async () => {
      const response = Object.assign({}, defaultResponse, {
        diagnostic: [
          {
            columnNumber: 1,
            lineNumber: 6,
            compileProblem: '',
            exceptionMessage: 'System.AssertException: Assertion Failed',
            exceptionStackTrace: 'AnonymousBlock: line 6, column 1'
          }
        ]
      });
      executeStub.resolves(response);
      const expectedDiagnostic = {
        message: response.diagnostic[0].exceptionMessage,
        severity: vscode.DiagnosticSeverity.Error,
        source: file,
        range: new vscode.Range(5, 0, 5, 0)
      };

      await executor.run({ data: { fileName: file }, type: 'CONTINUE' });

      expect(setDiagnosticStub.calledOnce).to.be.true;
      expect(setDiagnosticStub.firstCall.args[0].path).to.deep.equal(file);
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([
        expectedDiagnostic
      ]);
    });

    it('should set unexpected message as message if compile problem and exception message empty strings', async () => {
      const response = Object.assign({}, defaultResponse, {
        diagnostic: [
          {
            columnNumber: 1,
            lineNumber: 6,
            compileProblem: '',
            exceptionMessage: '',
            exceptionStackTrace: 'AnonymousBlock: line 6, column 1'
          }
        ]
      });
      executeStub.resolves(response);
      const expectedDiagnostic = {
        message: nls.localize('apex_execute_unexpected_error'),
        severity: vscode.DiagnosticSeverity.Error,
        source: file,
        range: new vscode.Range(5, 0, 5, 0)
      };

      await executor.run({ data: { fileName: file }, type: 'CONTINUE' });

      expect(setDiagnosticStub.calledOnce).to.be.true;
      expect(setDiagnosticStub.firstCall.args[0].path).to.deep.equal(file);
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([
        expectedDiagnostic
      ]);
    });
  });
});
