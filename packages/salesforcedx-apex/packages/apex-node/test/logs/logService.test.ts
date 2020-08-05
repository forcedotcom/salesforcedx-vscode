/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect, assert } from 'chai';
import * as fs from 'fs';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { LogService } from '../../src/logs/logService';
import * as path from 'path';
import * as stream from 'stream';

const $$ = testSetup();

describe('Apex Log Service Tests', () => {
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  let toolingRequestStub: SinonStub;

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
    toolingRequestStub = sandboxStub.stub(
      LogService.prototype,
      'toolingRequest'
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should return correct number of logs', async () => {
    const apexLogGet = new LogService(mockConnection);
    const logs = ['07WgsWfsFF', 'FTWrd5lfg'];
    const ids = [{ Id: '48jnskd' }, { Id: '67knmdfklDF' }];
    const queryRecords = { records: ids };
    toolingRequestStub.onFirstCall().resolves(logs[0]);
    toolingRequestStub.onSecondCall().resolves(logs[1]);
    const toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
    //@ts-ignore
    toolingQueryStub.onFirstCall().resolves(queryRecords);
    const response = await apexLogGet.getLogs({ numberOfLogs: 2 });
    expect(response.length).to.eql(2);
  });

  it('should return correct log given log id', async () => {
    const apexLogGet = new LogService(mockConnection);
    const log = '48.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT..';
    const getLogIdStub = sandboxStub.stub(LogService.prototype, 'getLogIds');
    toolingRequestStub.onFirstCall().resolves(log);
    const response = await apexLogGet.getLogs({ logId: '07L5w00005PGdTnEAL' });
    expect(response.length).to.eql(1);
    expect(getLogIdStub.callCount).to.eql(0);
  });

  it('should handle exceeding log limit', async () => {
    const apexLogGet = new LogService(mockConnection);
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
    const toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
    //@ts-ignore
    toolingQueryStub.onFirstCall().resolves(queryRecords);
    const response = await apexLogGet.getLogs({ numberOfLogs: 27 });
    expect(response.length).to.eql(25);
  });

  it('should handle invalid id', async () => {
    const apexLogGet = new LogService(mockConnection);
    toolingRequestStub.throws(new Error('invalid id'));
    try {
      await apexLogGet.getLogs({ logId: '07L5tgg0005PGdTnEAL' });
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('invalid id');
    }
  });

  it('should throw an error if 0 logs are requested', async () => {
    const apexLogGet = new LogService(mockConnection);
    try {
      await apexLogGet.getLogs({ numberOfLogs: 0 });
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal(
        'Expected number of logs to be greater than 0.'
      );
    }
  });

  it('should store logs in the directory', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('testTmp', 'file', 'path', 'logs');
    const logIds = ['07L5tgg0005PGdTnEAL', '07L5tgg0005PGdTnFPL'];
    sandboxStub.stub(LogService.prototype, 'getLogIds').resolves(logIds);

    const createStreamStub = sandboxStub.stub(fs, 'createWriteStream');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createStreamStub.onCall(0).returns(new stream.PassThrough() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createStreamStub.onCall(1).returns(new stream.PassThrough() as any);
    sandboxStub.stub(fs, 'closeSync');
    sandboxStub.stub(fs, 'openSync');

    const logs = ['48jnskd', '57fskjf'];
    toolingRequestStub.onFirstCall().resolves(logs[0]);
    toolingRequestStub.onSecondCall().resolves(logs[1]);
    const response = await apexLogGet.getLogs({
      numberOfLogs: 2,
      outputDir: filePath
    });
    expect(response).to.deep.equal([
      path.join(filePath, '07L5tgg0005PGdTnEAL.log'),
      path.join(filePath, '07L5tgg0005PGdTnFPL.log')
    ]);
    expect(createStreamStub.callCount).to.eql(2);
  });

  it('should successfully create a .log file', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('path', 'to', 'logs');
    const logIds = ['07WgsWfad'];
    const logs = ['log content'];
    const logsPath = path.join(filePath, `${logIds[0]}.log`);
    sandboxStub.stub(fs, 'existsSync').returns(true);
    const createStreamStub = sandboxStub.stub(fs, 'createWriteStream');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createStreamStub.onCall(0).returns(new stream.PassThrough() as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createStreamStub.onCall(1).returns(new stream.PassThrough() as any);
    sandboxStub.stub(fs, 'closeSync');
    sandboxStub.stub(fs, 'openSync');
    toolingRequestStub.onFirstCall().resolves(logs[0]);
    toolingRequestStub.onSecondCall().resolves(logs[1]);
    await apexLogGet.getLogs({
      logId: '07WgsWfad',
      outputDir: filePath
    });
    expect(createStreamStub.calledWith(logsPath)).to.be.true;
  });

  it('should throw an error if numberOfLogs or logId are not given', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('path', 'to', 'logs');
    try {
      await apexLogGet.getLogs({ outputDir: filePath });
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal(
        'To retrieve logs, specify the log ID or the number of logs.'
      );
    }
  });
});
