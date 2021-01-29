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
import {
  AnonApexGatherer,
  ApexLibraryExecuteExecutor,
  CreateApexTempFile,
  forceApexExecute,
  ForceApexExecuteExecutor
} from '../../../src/commands/forceApexExecute';
import { OUTPUT_CHANNEL } from '../../../src/constants';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';

const sb = createSandbox();

// tslint:disable:no-unused-expression
describe('Force Apex Execute', () => {
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
    let apexExecutorStub: SinonStub;
    let cliExecutorStub: SinonStub;
    let anonGather: SinonStub;
    let apexTempFile: SinonStub;

    beforeEach(() => {
      settingStub = sb
        .stub()
        .withArgs('experimental.useApexLibrary')
        .returns(true);
      sb.stub(vscode.workspace, 'getConfiguration').returns({
        get: settingStub
      });
      apexExecutorStub = sb.stub(
        ApexLibraryExecuteExecutor.prototype,
        'execute'
      );
      cliExecutorStub = sb.stub(ForceApexExecuteExecutor.prototype, 'execute');
      anonGather = sb
        .stub(AnonApexGatherer.prototype, 'gather')
        .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);
      apexTempFile = sb
        .stub(CreateApexTempFile.prototype, 'gather')
        .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);
    });

    it('should use the ApexLibraryExecuteExecutor if setting is false', async () => {
      settingStub.returns(true);
      await forceApexExecute();
      expect(apexExecutorStub.calledOnce).to.be.true;
      expect(anonGather.calledOnce).to.be.true;
      expect(cliExecutorStub.called).to.be.false;
      expect(apexTempFile.called).to.be.false;
    });

    it('should use the ForceApexExecuteExecutor if setting is true', async () => {
      settingStub.returns(false);
      await forceApexExecute();
      expect(cliExecutorStub.calledOnce).to.be.true;
      expect(apexTempFile.calledOnce).to.be.true;
      expect(apexExecutorStub.called).to.be.false;
      expect(anonGather.called).to.be.false;
    });
  });

  describe('Format Execute Anonymous Response', () => {
    let outputStub: SinonStub;

    beforeEach(() => {
      sb.stub(workspaceContext, 'getConnection');
      sb.stub(vscode.window, 'activeTextEditor').get(() => ({
        document: {
          uri: vscode.Uri.file('/test')
        }
      }));
      outputStub = sb.stub(OUTPUT_CHANNEL, 'appendLine');
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
});
