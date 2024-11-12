/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteService } from '@salesforce/apex-node-bundle';
import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core-bundle';
import { MockTestOrgData, TestContext } from '@salesforce/core-bundle';
import {
  ChannelService,
  ContinueResponse,
  projectPaths,
  SFDX_CORE_CONFIGURATION_NAME,
  TraceFlags
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import { AnonApexGatherer, AnonApexLibraryExecuteExecutor } from '../../../src/commands/anonApexExecute';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Apex Execute', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sb: SinonSandbox;
  let traceFlagsStub: SinonStub;
  let settingStub: SinonStub;
  let writeFileStub: SinonStub;
  let executeCommandStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    settingStub = sb.stub();
    sb.stub(vscode.workspace, 'getConfiguration').withArgs(SFDX_CORE_CONFIGURATION_NAME).returns({
      get: settingStub
    });
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue').withArgs('target-org').returns(testData.username);
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);

    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);

    sb.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: {
        uri: vscode.Uri.file('/test')
      }
    }));

    writeFileStub = sb.stub(fs, 'writeFileSync').returns(true);

    executeCommandStub = sb
      .stub(vscode.commands, 'executeCommand')
      .withArgs('sf.launch.replay.debugger.logfile.path')
      .returns(true);
  });

  afterEach(() => {
    sb.restore();
  });

  describe('AnonApexGatherer', async () => {
    it('should return the selected file to execute anonymous apex', async () => {
      const fileName = path.join(projectPaths.stateFolder(), 'tools', 'tempApex.input');
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
      const fileName = path.join(projectPaths.stateFolder(), 'tools', 'tempApex.input');
      const mockActiveTextEditor = {
        document: {
          uri: { fsPath: fileName },
          getText: () => text,
          isUntitled: true,
          isDirty: true
        },
        selection: {
          isEmpty: true,
          text: 'System.assert(false);'
        }
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

    it("should return the currently highlighted 'selection' to execute anonymous apex", async () => {
      const mockActiveTextEditor = {
        document: {
          getText: (doc: { isEmpty: boolean; text: string }) => doc.text,
          isUntitled: true,
          isDirty: false
        },
        selection: {
          isEmpty: false,
          text: 'System.assert(true);',
          start: new vscode.Position(1, 1),
          end: new vscode.Position(1, 19)
        }
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

  describe('Format Execute Anonymous Response', () => {
    let outputStub: SinonStub;
    let showChannelOutputStub: SinonSpy;
    let setDiagnosticStub: SinonStub;
    let debugLogsfolder: SinonStub;
    const file = '/test';

    beforeEach(() => {
      outputStub = sb.stub(channelService, 'appendLine');
      showChannelOutputStub = sb.spy(ChannelService.prototype, 'showChannelOutput');
      setDiagnosticStub = sb.stub(AnonApexLibraryExecuteExecutor.diagnostics, 'set');
      debugLogsfolder = sb.stub(projectPaths, 'debugLogsFolder').returns('.sfdx/tools/debug/logs');
    });

    it('should format result correctly for a successful execution', async () => {
      const executor = new AnonApexLibraryExecuteExecutor(true);
      const execAnonResponse = {
        compiled: true,
        success: true,
        logs: '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n',
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
      )}\n${nls.localize('apex_execute_runtime_success')}\n\n${execAnonResponse.logs}`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(execAnonResponse);

      await executor.run({ type: 'CONTINUE', data: {} });
      expect(showChannelOutputStub.notCalled).to.be.true;
      expect(outputStub.firstCall.args[0]).to.equal(expectedOutput);
    });

    it('should format result correctly for a compilation failure', async () => {
      const executor = new AnonApexLibraryExecuteExecutor(true);
      const execAnonResponse = {
        compiled: false,
        success: false,
        logs: '',
        diagnostic: [
          {
            columnNumber: 1,
            lineNumber: 6,
            compileProblem: "Unexpected token '('.",
            exceptionMessage: '',
            exceptionStackTrace: ''
          }
        ]
      };
      const expectedOutput = `Error: Line: ${execAnonResponse.diagnostic[0].lineNumber}, Column: ${execAnonResponse.diagnostic[0].columnNumber}\nError: ${execAnonResponse.diagnostic[0].compileProblem}\n`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(execAnonResponse);

      await executor.run({ type: 'CONTINUE', data: {} });
      expect(showChannelOutputStub.notCalled).to.be.true;
      expect(outputStub.firstCall.args[0]).to.equal(expectedOutput);
    });

    it('should format result correctly for a runtime failure', async () => {
      const executor = new AnonApexLibraryExecuteExecutor(true);
      const execAnonResponse = {
        compiled: true,
        success: false,
        logs: '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n',
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
      const { exceptionMessage, exceptionStackTrace } = execAnonResponse.diagnostic[0];
      const expectedOutput = `${nls.localize(
        'apex_execute_compile_success'
      )}\nError: ${exceptionMessage}\nError: ${exceptionStackTrace}\n\n${execAnonResponse.logs}`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(execAnonResponse);

      await executor.run({ type: 'CONTINUE', data: {} });
      expect(showChannelOutputStub.notCalled).to.be.true;
      expect(outputStub.firstCall.args[0]).to.equal(expectedOutput);
    });

    it('should translate result line position correctly for a selected text failure', async () => {
      const executor = new AnonApexLibraryExecuteExecutor(true);
      const execAnonResponse = {
        compiled: true,
        success: false,
        logs: '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n',
        diagnostic: [
          {
            columnNumber: 1,
            lineNumber: 1,
            compileProblem: '',
            exceptionMessage: 'System.AssertException: Assertion Failed',
            exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
          }
        ]
      };
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(execAnonResponse);

      const expectedDiagnostic = {
        message: execAnonResponse.diagnostic[0].exceptionMessage,
        severity: vscode.DiagnosticSeverity.Error,
        source: file,
        range: new vscode.Range(3, 0, 3, 0)
      };

      await executor.run({
        type: 'CONTINUE',
        data: {
          fileName: file,
          selection: new vscode.Range(new vscode.Position(3, 1), new vscode.Position(3, 22))
        }
      });

      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([expectedDiagnostic]);
    });
  });

  describe('Report Diagnostics', () => {
    const executor = new AnonApexLibraryExecuteExecutor(true);
    const file = '/test';
    const defaultResponse = {
      compiled: true,
      success: false,
      logs: '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n',
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
      setDiagnosticStub = sb.stub(AnonApexLibraryExecuteExecutor.diagnostics, 'set');
      executeStub = sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(defaultResponse);
    });

    it('should clear diagnostics before setting new ones', async () => {
      const clearStub = sb.stub(AnonApexLibraryExecuteExecutor.diagnostics, 'clear');

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
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([expectedDiagnostic]);
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
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([expectedDiagnostic]);
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
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([expectedDiagnostic]);
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
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([expectedDiagnostic]);
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
      expect(setDiagnosticStub.firstCall.args[1]).to.deep.equal([expectedDiagnostic]);
    });
  });

  describe('Apex Replay Debugger', () => {
    let outputStub: SinonStub;
    let showChannelOutputStub: SinonSpy;
    let setDiagnosticStub: SinonStub;
    const file = '/test';

    beforeEach(() => {
      outputStub = sb.stub(channelService, 'appendLine');
      showChannelOutputStub = sb.spy(ChannelService.prototype, 'showChannelOutput');
      setDiagnosticStub = sb.stub(AnonApexLibraryExecuteExecutor.diagnostics, 'set');
    });

    it('should set up trace flags and run the Apex replay debugger when AnonApexLibraryExecuteExecutor(true) runs', async () => {
      const executor = new AnonApexLibraryExecuteExecutor(true);
      const execAnonResponse = {
        compiled: true,
        success: true,
        logs: '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n',
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
      )}\n${nls.localize('apex_execute_runtime_success')}\n\n${execAnonResponse.logs}`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(execAnonResponse);

      await executor.run({ type: 'CONTINUE', data: {} });

      expect(traceFlagsStub.called).to.be.true;
      expect(executeCommandStub.called).to.be.true;
    });

    it('should not set up trace flags and should not run the Apex replay debugger when AnonApexLibraryExecuteExecutor(false) runs', async () => {
      const executor = new AnonApexLibraryExecuteExecutor(false);
      const execAnonResponse = {
        compiled: true,
        success: true,
        logs: '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n',
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
      )}\n${nls.localize('apex_execute_runtime_success')}\n\n${execAnonResponse.logs}`;
      sb.stub(ExecuteService.prototype, 'executeAnonymous').resolves(execAnonResponse);

      await executor.run({ type: 'CONTINUE', data: {} });

      expect(traceFlagsStub.called).to.be.false;
      expect(executeCommandStub.called).to.be.false;
    });
  });
});
