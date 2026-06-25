/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SinonStub } from 'sinon';
import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { ExecuteService } from '../../src/execute/executeService';
import { nls } from '../../src/i18n';
import { ExecuteAnonymousResponse, SoapResponse, ExecAnonApiResponse } from '../../src/execute/types';
import * as os from 'node:os';

describe('Apex Execute Tests', () => {
  const $$ = new TestContext();

  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let fsStub: SinonStub;

  beforeEach(async () => {
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');

    await $$.stubAuths(testData);
    mockConnection = await testData.getConnection();

    $$.SANDBOX.stub(fs, 'readFileSync').returns('System.assert(true);');
    fsStub = $$.SANDBOX.stub(fs, 'existsSync').returns(true);
  });

  it('should execute and display successful result in correct format', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n';
    const execAnonResult = {
      column: -1,
      line: -1,
      compiled: 'true',
      compileProblem: '',
      exceptionMessage: '',
      exceptionStackTrace: '',
      success: 'true'
    };
    const soapResponse: SoapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: { result: execAnonResult }
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      compiled: true,
      success: true,
      logs: log
    };
    $$.SANDBOX.stub(ExecuteService.prototype, 'connectionRequest').resolves(soapResponse);
    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });

    expect(response).toEqual(expectedResult);
  });

  it('should execute and display successful result when no DebuggingInfo header', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const execAnonResult = {
      column: -1,
      line: -1,
      compiled: 'true',
      compileProblem: '',
      exceptionMessage: '',
      exceptionStackTrace: '',
      success: 'true'
    };
    const soapResponse: SoapResponse = {
      'soapenv:Envelope': {
        'soapenv:Body': {
          executeAnonymousResponse: { result: execAnonResult }
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      compiled: true,
      success: true,
      logs: undefined
    };
    $$.SANDBOX.stub(ExecuteService.prototype, 'connectionRequest').resolves(soapResponse);
    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });

    expect(response).toEqual(expectedResult);
  });

  it('should execute and display runtime issue in correct format', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(false);|EXECUTION_FINISHED\n';
    const execAnonResult: ExecAnonApiResponse = {
      column: 1,
      line: 6,
      compiled: 'true',
      compileProblem: '',
      exceptionMessage: 'System.AssertException: Assertion Failed',
      exceptionStackTrace: 'AnonymousBlock: line 1, column 1',
      success: 'false'
    };
    const soapResponse: SoapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: { result: execAnonResult }
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      compiled: true,
      success: false,
      logs: log,
      diagnostic: [
        {
          exceptionMessage: 'System.AssertException: Assertion Failed',
          exceptionStackTrace: 'AnonymousBlock: line 1, column 1',
          compileProblem: '',
          columnNumber: 1,
          lineNumber: 6
        }
      ]
    };
    $$.SANDBOX.stub(ExecuteService.prototype, 'connectionRequest').resolves(soapResponse);

    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });
    expect(response).toEqual(expectedResult);
  });

  it('should execute and display compile issue in correct format', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const execAnonResult = {
      column: 1,
      line: 6,
      compiled: 'false',
      compileProblem: "Unexpected token '('.",
      exceptionMessage: '',
      exceptionStackTrace: '',
      success: 'false'
    };
    const soapResponse: SoapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: '' } },
        'soapenv:Body': {
          executeAnonymousResponse: { result: execAnonResult }
        }
      }
    };

    const expectedResult: ExecuteAnonymousResponse = {
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
    $$.SANDBOX.stub(ExecuteService.prototype, 'connectionRequest').resolves(soapResponse);

    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });
    expect(response).toEqual(expectedResult);
  });

  it('should handle access token session id error correctly', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n';
    const execAnonResult = {
      column: -1,
      line: -1,
      compiled: 'true',
      compileProblem: '',
      exceptionMessage: '',
      exceptionStackTrace: '',
      success: 'true'
    };
    const soapResponse: SoapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: { result: execAnonResult }
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      compiled: true,
      success: true,
      logs: log
    };

    const connRequestStub = $$.SANDBOX.stub(ExecuteService.prototype, 'connectionRequest');
    const error = new Error('INVALID_SESSION_ID');
    error.name = 'ERROR_HTTP_500';
    connRequestStub.onFirstCall().throws(error);
    connRequestStub.onSecondCall().resolves(soapResponse);

    const response = await apexExecute.executeAnonymous({
      apexFilePath: 'filepath/to/anonApex/file'
    });
    expect(response).toEqual(expectedResult);
    expect(connRequestStub.calledTwice).toBe(true);
  });

  it('should raise an error when the source file is not found', async () => {
    const apexFile = 'filepath/to/anonApex/file';
    const apexExecute = new ExecuteService(mockConnection);
    fsStub.restore();
    fsStub.returns(false);

    await expect(apexExecute.executeAnonymous({ apexFilePath: apexFile })).rejects.toThrow(
      nls.localize('fileNotFoundError', apexFile)
    );
  });

  it('should handle Buffer input correctly', async () => {
    const apexExecute = new ExecuteService(mockConnection);
    const log =
      '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n';
    const bufferInput = Buffer.from('System.assert(true);');
    const execAnonResult = {
      column: -1,
      line: -1,
      compiled: 'true',
      compileProblem: '',
      exceptionMessage: '',
      exceptionStackTrace: '',
      success: 'true'
    };
    const soapResponse: SoapResponse = {
      'soapenv:Envelope': {
        'soapenv:Header': { DebuggingInfo: { debugLog: log } },
        'soapenv:Body': {
          executeAnonymousResponse: { result: execAnonResult }
        }
      }
    };
    const expectedResult: ExecuteAnonymousResponse = {
      compiled: true,
      success: true,
      logs: log
    };
    $$.SANDBOX.stub(ExecuteService.prototype, 'connectionRequest').resolves(soapResponse);
    const response = await apexExecute.executeAnonymous({
      apexCode: bufferInput
    });

    expect(response).toEqual(expectedResult);
  });

  it('should throw an error if no option is specified', async () => {
    const executeService = new ExecuteService(mockConnection);
    await expect(executeService.executeAnonymous({})).rejects.toThrow(nls.localize('optionExecAnonError'));
  });

  it('should throw an error if user input fails', async () => {
    const errorText = 'This is the error';

    const on = (event: string, listener: (err?: Error) => {}) => {
      if (event === 'error') {
        listener(new Error(errorText));
      }
      listener();
    };
    $$.SANDBOX.stub(readline, 'createInterface')
      //@ts-ignore
      .returns({ on });

    const executeService = new ExecuteService(mockConnection);
    try {
      await executeService.getUserInput();
    } catch (e) {
      expect((e as Error).message).toEqual(nls.localize('unexpectedExecAnonInputError', errorText));
    }
  });

  it('should process user input correctly', async () => {
    const inputText = 'This should be the only text';

    const on = (event: string, listener: (input: string) => {}) => {
      listener(inputText);
    };
    $$.SANDBOX.stub(readline, 'createInterface')
      //@ts-ignore
      .returns({ on });

    const executeService = new ExecuteService(mockConnection);
    const text = await executeService.getUserInput();
    expect(text).toBe(`${inputText}${os.EOL}`);
  });

  it('should throw error if user is idle', async () => {
    const on = (event: string, listener: () => {}) => {
      listener();
    };
    $$.SANDBOX.stub(readline, 'createInterface')
      //@ts-ignore
      .returns({ on });

    const executeService = new ExecuteService(mockConnection);
    try {
      await executeService.getUserInput();
    } catch (e) {
      expect((e as Error).message).toEqual(nls.localize('execAnonInputTimeout'));
    }
  });
});
