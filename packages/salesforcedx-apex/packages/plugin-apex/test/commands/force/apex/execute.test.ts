/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { test } from '@salesforce/command/lib/test';
import { expect } from 'chai';
import { ExecuteService } from '@salesforce/apex-node';

describe('force:apex:execute', () => {
  const log =
    '47.0 APEX_CODE,DEBUG;APEX_PROFILING,INFO\nExecute Anonymous: System.assert(true);|EXECUTION_FINISHED\n';
  const successJsonResult = {
    column: -1,
    line: -1,
    compiled: 'true',
    compileProblem: '',
    exceptionMessage: '',
    exceptionStackTrace: '',
    success: 'true'
  };
  const soapResponse = {
    'soapenv:Envelope': {
      'soapenv:Header': { DebuggingInfo: { debugLog: log } },
      'soapenv:Body': {
        executeAnonymousResponse: { result: successJsonResult }
      }
    }
  };
  const expectedSuccessResult = {
    column: -1,
    line: -1,
    compiled: true,
    compileProblem: '',
    exceptionMessage: '',
    exceptionStackTrace: '',
    success: true,
    logs: log
  };

  const compileProblem = {
    column: 1,
    line: 11,
    compiled: 'false',
    compileProblem: 'problem compiling',
    exceptionMessage: '',
    exceptionStackTrace: '',
    success: 'false'
  };
  const soapCompileProblem = {
    'soapenv:Envelope': {
      'soapenv:Header': { DebuggingInfo: { debugLog: log } },
      'soapenv:Body': {
        executeAnonymousResponse: { result: compileProblem }
      }
    }
  };
  const expectedCompileProblem = {
    column: 1,
    line: 11,
    compiled: false,
    compileProblem: 'problem compiling',
    exceptionMessage: '',
    exceptionStackTrace: '',
    success: false,
    logs: log
  };

  const runtimeProblem = {
    column: 1,
    line: 11,
    compiled: 'true',
    compileProblem: '',
    exceptionMessage: 'problem at runtime',
    exceptionStackTrace: 'Issue in mock file',
    success: 'false'
  };
  const soapRuntimeProblem = {
    'soapenv:Envelope': {
      'soapenv:Header': { DebuggingInfo: { debugLog: log } },
      'soapenv:Body': {
        executeAnonymousResponse: { result: runtimeProblem }
      }
    }
  };

  const successfulResponse = `Compiled successfully.\nExecuted successfully.\n\n${log}\n`;
  const compileResponse =
    'Error: Line: 11, Column: 1\nError: problem compiling\n\n';
  const runtimeResponse = `Compiled successfully.\nError: problem at runtime\nError: Issue in mock file\n\n${log}\n`;

  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(() => {
      return Promise.resolve(soapResponse);
    })
    .stub(
      ExecuteService.prototype,
      'readApexFile',
      () => 'System.assert(true);'
    )
    .stub(ExecuteService.prototype, 'buildExecRequest', () => {
      'fakeData';
    })
    .stdout()
    .command([
      'force:apex:execute',
      '--apexcodefile',
      path.join('Users', 'test', 'path', 'to', 'file'),
      '--json'
    ])
    .it('runs command with filepath flag and successful result', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      const resultJSON = JSON.parse(result);
      console.log(resultJSON + 'hello');
      expect(resultJSON).to.ownProperty('status');
      expect(resultJSON.status).to.equal(0);
      expect(resultJSON).to.ownProperty('result');
      expect(resultJSON.result).to.deep.include(expectedSuccessResult);
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(() => {
      return Promise.resolve(soapResponse);
    })
    .stub(
      ExecuteService.prototype,
      'getUserInput',
      () => 'System.assert(true);'
    )
    .stub(ExecuteService.prototype, 'buildExecRequest', () => {
      'fakeData';
    })
    .stdout()
    .command([
      'force:apex:execute',
      '--targetusername',
      'test@org.com',
      '--json'
    ])
    .it('runs default command with json flag and successful result', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      const resultJSON = JSON.parse(result);
      expect(resultJSON).to.ownProperty('status');
      expect(resultJSON.status).to.equal(0);
      expect(resultJSON).to.ownProperty('result');
      expect(resultJSON.result).to.deep.include(expectedSuccessResult);
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(() => {
      return Promise.resolve(soapCompileProblem);
    })
    .stub(ExecuteService.prototype, 'getUserInput', () => 'System.assert(true)')
    .stub(ExecuteService.prototype, 'buildExecRequest', () => {
      'fakeData';
    })
    .stdout()
    .command([
      'force:apex:execute',
      '--targetusername',
      'test@org.com',
      '--json'
    ])
    .it('runs default command with json flag and compile problem', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      const resultJSON = JSON.parse(result);
      expect(resultJSON).to.ownProperty('result');
      expect(resultJSON.result).to.deep.include(expectedCompileProblem);
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(() => {
      return Promise.resolve(soapResponse);
    })
    .stub(ExecuteService.prototype, 'getUserInput', () => 'System.assert(true)')
    .stub(ExecuteService.prototype, 'buildExecRequest', () => {
      'fakeData';
    })
    .stdout()
    .command(['force:apex:execute', '--targetusername', 'test@org.com'])
    .it('runs default command successfully with human readable output', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.eql(successfulResponse);
    });

  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(() => {
      return Promise.resolve(soapCompileProblem);
    })
    .stub(ExecuteService.prototype, 'getUserInput', () => 'System.assert(true)')
    .stub(ExecuteService.prototype, 'buildExecRequest', () => {
      'fakeData';
    })
    .stdout()
    .command(['force:apex:execute', '--targetusername', 'test@org.com'])
    .it(
      'runs default command with compile issue in human readable output',
      ctx => {
        const result = ctx.stdout;
        expect(result).to.not.be.empty;
        expect(result).to.eql(compileResponse);
      }
    );

  test
    .withOrg({ username: 'test@org.com' }, true)
    .withConnectionRequest(() => {
      return Promise.resolve(soapRuntimeProblem);
    })
    .stub(ExecuteService.prototype, 'getUserInput', () => 'System.assert(true)')
    .stub(ExecuteService.prototype, 'buildExecRequest', () => {
      'fakeData';
    })
    .stdout()
    .command(['force:apex:execute', '--targetusername', 'test@org.com'])
    .it(
      'runs default command with runtime issue in human readable output',
      ctx => {
        const result = ctx.stdout;
        expect(result).to.not.be.empty;
        expect(result).to.eql(runtimeResponse);
      }
    );
});
