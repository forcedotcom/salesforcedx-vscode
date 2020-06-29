/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect, assert } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import { ApexLogGet } from '../../src/commands/apexLogGet';

const $$ = testSetup();

describe('Apex Log Get Tests', () => {
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

  it('should return correct number of logs', async () => {
    const apexLogGet = new ApexLogGet(mockConnection);
    const logs = ['07WgsWfsFF', 'FTWrd5lfg'];
    const ids = [{ Id: '48jnskd' }, { Id: '67knmdfklDF' }];
    const queryRecords = { records: ids };
    const connRequestStub = sandboxStub.stub(
      ApexLogGet.prototype,
      'connectionRequest'
    );
    connRequestStub.onFirstCall().resolves(logs[0]);
    connRequestStub.onSecondCall().resolves(logs[1]);
    const connectionToolingStub = sandboxStub.stub(
      mockConnection.tooling,
      'query'
    );
    //@ts-ignore
    connectionToolingStub.onFirstCall().resolves(queryRecords);
    const response = await apexLogGet.execute({ numberOfLogs: 2 });
    expect(response.length).to.eql(2);
  });

  it('should return correct log given log id', async () => {
    const apexLogGet = new ApexLogGet(mockConnection);
    const log = '48.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT..';
    const getLogIdStub = sandboxStub.stub(ApexLogGet.prototype, 'getLogIds');
    const connRequestStub = sandboxStub.stub(
      ApexLogGet.prototype,
      'connectionRequest'
    );
    connRequestStub.onFirstCall().resolves(log);
    const response = await apexLogGet.execute({ logId: '07L5w00005PGdTnEAL' });
    expect(response.length).to.eql(1);
    expect(getLogIdStub.callCount).to.eql(0);
  });

  it('should handle exceeding log limit', async () => {
    const apexLogGet = new ApexLogGet(mockConnection);
    const ids = [
      { Id: '48jnskd' },
      { Id: '67knmdfklDF' },
      { Id: 'CODE' },
      { Id: 'FINEST' },
      { Id: 'PROFILING' },
      { Id: 'INFO' },
      { Id: 'CALLOUT' },
      { Id: 'ASDA' },
      { Id: 'ADAD' },
      { Id: 'Ajkl' },
      { Id: 'SADkl' },
      { Id: 'FSDFS' },
      { Id: 'DASD' },
      { Id: 'ASD' },
      { Id: 'NKJN' },
      { Id: 'ADA' },
      { Id: 'GGS' },
      { Id: 'ADASD' },
      { Id: 'SDA' },
      { Id: 'ADA' },
      { Id: 'JKH' },
      { Id: 'DH' },
      { Id: 'FGFD' },
      { Id: 'SFSDF' },
      { Id: 'DSASD' }
    ];
    const queryRecords = { records: ids };
    const connectionToolingStub = sandboxStub.stub(
      mockConnection.tooling,
      'query'
    );
    //@ts-ignore
    connectionToolingStub.onFirstCall().resolves(queryRecords);
    const response = await apexLogGet.execute({ numberOfLogs: 27 });
    expect(response.length).to.eql(25);
  });

  it('should handle invalid id', async () => {
    const apexLogGet = new ApexLogGet(mockConnection);
    sandboxStub
      .stub(ApexLogGet.prototype, 'connectionRequest')
      .throws(new Error('invalid id'));
    try {
      await apexLogGet.execute({ logId: '07L5tgg0005PGdTnEAL' });
      assert.fail;
    } catch (e) {
      expect(e.message).to.equal('invalid id');
    }
  });

  it('should throw an error if 0 logs are requested', async () => {
    const apexLogGet = new ApexLogGet(mockConnection);
    try {
      await apexLogGet.getLogIds(0);
      assert.fail;
    } catch (e) {
      expect(e.message).to.equal(
        'Expected number of logs to be greater than 0.'
      );
    }
  });
});
