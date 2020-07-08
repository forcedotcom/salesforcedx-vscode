/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { fail } from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import {
  AnonApexGatherer,
  ApexLibraryExecuteExecutor,
  formatResult
} from '../../../src/commands/forceApexExecute';
import {
  CompositeParametersGatherer,
  SfdxCommandlet
} from '../../../src/commands/util';
import { nls } from '../../../src/messages';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

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

describe('AnonApexGatherer', async () => {
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should return the selected file to execute anonymous apex', async () => {
    const fileName = path.join(
      getRootWorkspacePath(),
      '.sfdx',
      'tools',
      'tempApex.input'
    );
    const mockActiveTextEditor = {
      document: {
        uri: { fsPath: fileName }
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

  it(`should return the currently highlighted 'selection' to execute anonymous apex`, async () => {
    const mockActiveTextEditor = {
      document: {
        getText: (doc: { isEmpty: boolean; text: string }) => doc.text
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

describe('ApexLibraryExecuteExecutor', () => {
  // Setup the test environment.
  const $$ = testSetup();
  const testData = new MockTestOrgData();

  let mockConnection: Connection;
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    sb.restore();
  });

  it('Should call executor', async () => {
    let executed = false;
    const commandlet = new SfdxCommandlet(
      new class {
        public check(): boolean {
          return true;
        }
      }(),
      new CompositeParametersGatherer(
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }()
      ),
      new class extends ApexLibraryExecuteExecutor {
        public async execute(response: ContinueResponse<{}>): Promise<void> {
          executed = true;
        }
      }()
    );

    await commandlet.run();
    expect(executed).to.be.true;
  });

  it('Should create connection on build phase', async () => {
    const orgAuthMock = sb
      .stub(OrgAuthInfo, 'getDefaultUsernameOrAlias')
      .returns(testData.username);
    const orgAuthConnMock = sb
      .stub(OrgAuthInfo, 'getConnection')
      .returns(mockConnection);
    const commandlet = new class extends ApexLibraryExecuteExecutor {
      public async execute(response: ContinueResponse<{}>): Promise<void> {}
    }();

    await commandlet.build('Test name', 'telemetry_test');
    expect(orgAuthMock.calledOnce).to.equal(true);
    expect(orgAuthConnMock.calledOnce).to.equal(true);
  });

  it('Should fail build phase if username cannot be found', async () => {
    const orgAuthMock = sb
      .stub(OrgAuthInfo, 'getDefaultUsernameOrAlias')
      .returns(undefined);
    const orgAuthConnMock = sb.stub(OrgAuthInfo, 'getConnection');
    const commandlet = new class extends ApexLibraryExecuteExecutor {
      public async execute(response: ContinueResponse<{}>): Promise<void> {}
    }();
    try {
      await commandlet.build('Test name', 'telemetry_test');
      fail('build phase should throw an error');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('error_no_default_username'));
      expect(orgAuthMock.calledOnce).to.equal(true);
      expect(orgAuthConnMock.calledOnce).to.equal(false);
    }
  });
});
