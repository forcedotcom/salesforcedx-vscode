/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { ExecuteAnonymousResponse } from '../src/types';
import { ApexExecute } from '../src/commands/apexExecute';
import { createSandbox, SinonSandbox, sandbox } from 'sinon';
import { ApexService } from '../src/apexService';
import { ApexLogGet } from '../src/commands';

const $$ = testSetup();

describe('Apex Service Tests', () => {
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should run apexExecute command', async () => {
    const apexService = new ApexService(mockConnection);
    const execAnonResponse: ExecuteAnonymousResponse = {
      result: {
        column: -1,
        line: -1,
        compiled: true,
        compileProblem: '',
        exceptionMessage: '',
        exceptionStackTrace: '',
        success: true,
        logs: 'logs for successful run'
      }
    };
    sandboxStub
      .stub(ApexExecute.prototype, 'execute')
      .resolves(execAnonResponse);
    const response = await apexService.apexExecute({
      apexCodeFile: 'filepath/to/anonApex/file'
    });
    expect(response).to.eql(execAnonResponse);
  });

  it('should run apexLogGet command', async () => {
    const apexService = new ApexService(mockConnection);
    const logRecords = ['48.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT'];
    sandboxStub.stub(ApexLogGet.prototype, 'execute').resolves(logRecords);
    const response = await apexService.apexLogGet({ numberOfLogs: 1 });
    expect(response.length).to.eql(1);
  });
});
