/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SinonStub } from 'sinon';
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as fs from 'node:fs';
import { LogService } from '../../src/logs/logService';
import * as path from 'node:path';
import * as stream from 'node:stream';
import { LogRecord, LogResult } from '../../src/logs/types';

type LogQueryResult = {
  records: LogRecord[];
};

const logRecords: LogRecord[] = [
  {
    Id: '07L5tgg0005PGdTnEAL',
    Application: 'Unknown',
    DurationMilliseconds: 75,
    Location: 'Unknown',
    LogLength: 450,
    LogUser: {
      Name: 'Test User',
      attributes: {}
    },
    Operation: 'API',
    Request: 'API',
    StartTime: '2020-10-13T05:39:43.000+0000',
    Status: 'Assertion Failed'
  },
  {
    Id: '07L5tgg0005PGdTnFPL',
    Application: 'Unknown',
    DurationMilliseconds: 75,
    Location: 'Unknown',
    LogLength: 450,
    LogUser: {
      Name: 'Test User2',
      attributes: {}
    },
    Operation: 'API',
    Request: 'API',
    StartTime: '2020-10-13T05:39:43.000+0000',
    Status: 'Successful'
  }
];

const rawLogResult: LogQueryResult = {
  records: [
    {
      Id: '07L5tgg0005PGdTnEAL',
      Application: 'Unknown',
      DurationMilliseconds: 75,
      Location: 'Unknown',
      LogLength: 450,
      LogUser: {
        Name: 'Test User',
        attributes: {}
      },
      Operation: 'API',
      Request: 'API',
      StartTime: '2020-10-13T05:39:43.000+0000',
      Status: 'Assertion Failed'
    },
    {
      Id: '07L5tgg0005PGdTnFPL',
      Application: 'Unknown',
      DurationMilliseconds: 75,
      Location: 'Unknown',
      LogLength: 450,
      LogUser: {
        Name: 'Test User2',
        attributes: {}
      },
      Operation: 'API',
      Request: 'API',
      StartTime: '2020-10-13T05:39:43.000+0000',
      Status: 'Successful'
    }
  ]
};

describe('Apex Log Service Tests', () => {
  const $$ = new TestContext();

  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let toolingRequestStub: SinonStub;

  beforeEach(async () => {
    await $$.stubAuths(testData);

    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    toolingRequestStub = $$.SANDBOX.stub(LogService.prototype, 'toolingRequest');
  });

  it('should return correct number of logs', async () => {
    const apexLogGet = new LogService(mockConnection);
    const logs = ['07WgsWfsFF', 'FTWrd5lfg'];
    const ids = [{ Id: '48jnskd' }, { Id: '67knmdfklDF' }];
    const queryRecords = { records: ids };
    toolingRequestStub.onFirstCall().resolves(logs[0]);
    toolingRequestStub.onSecondCall().resolves(logs[1]);
    const toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    //@ts-ignore
    toolingQueryStub.onFirstCall().resolves(queryRecords);
    const response = await apexLogGet.getLogs({
      numberOfLogs: 2
    });
    expect(response).toHaveLength(2);
  });

  it('should return correct log given log id', async () => {
    const apexLogGet = new LogService(mockConnection);
    const log = '48.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT..';
    const getLogIdStub = $$.SANDBOX.stub(LogService.prototype, 'getLogRecords');
    toolingRequestStub.onFirstCall().resolves(log);
    const response = await apexLogGet.getLogs({
      logId: '07L5w00005PGdTnEAL'
    });
    expect(response).toHaveLength(1);
    expect(getLogIdStub.callCount).toBe(0);
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
    const queryRecords = { records: ids, done: true, totalSize: ids.length };
    const toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingQueryStub.onFirstCall().resolves(queryRecords);

    const getLogByIdStub = $$.SANDBOX.stub(LogService.prototype, 'getLogById');
    getLogByIdStub.resolves({ log: 'log' });
    const response = await apexLogGet.getLogs({
      numberOfLogs: 27
    });
    expect(response).toHaveLength(25);
  });

  it('should handle invalid id', async () => {
    const apexLogGet = new LogService(mockConnection);
    toolingRequestStub.throws(new Error('invalid id'));
    await expect(apexLogGet.getLogs({ logId: '07L5tgg0005PGdTnEAL' })).rejects.toThrow('invalid id');
  });

  it('should throw an error if 0 logs are requested', async () => {
    const apexLogGet = new LogService(mockConnection);
    await expect(apexLogGet.getLogs({ numberOfLogs: 0 })).rejects.toThrow(
      'Expected number of logs to be greater than 0.'
    );
  });

  it('should store logs in the directory', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('testTmp', 'file', 'path', 'logs');
    $$.SANDBOX.stub(LogService.prototype, 'getLogRecords').resolves(logRecords);

    const createStreamStub = $$.SANDBOX.stub(fs, 'createWriteStream');

    createStreamStub.onCall(0).returns(new stream.PassThrough() as any);

    createStreamStub.onCall(1).returns(new stream.PassThrough() as any);
    $$.SANDBOX.stub(fs, 'closeSync');
    $$.SANDBOX.stub(fs, 'openSync');

    const logs = ['48jnskd', '57fskjf'];
    toolingRequestStub.onFirstCall().resolves(logs[0]);
    toolingRequestStub.onSecondCall().resolves(logs[1]);

    const logResult: LogResult[] = [
      { log: logs[0], logPath: path.join(filePath, `${logRecords[0].Id}.log`) },
      { log: logs[1], logPath: path.join(filePath, `${logRecords[1].Id}.log`) }
    ];

    const response = await apexLogGet.getLogs({
      numberOfLogs: 2,
      outputDir: filePath
    });

    expect(response).toEqual(logResult);
    expect(createStreamStub.callCount).toBe(2);
  });

  it('should successfully create a .log file', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('path', 'to', 'logs');
    const logIds = ['07WgsWfad'];
    const logs = ['log content'];
    const logsPath = path.join(filePath, `${logIds[0]}.log`);
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    const createStreamStub = $$.SANDBOX.stub(fs, 'createWriteStream');

    createStreamStub.onCall(0).returns(new stream.PassThrough() as any);

    createStreamStub.onCall(1).returns(new stream.PassThrough() as any);
    $$.SANDBOX.stub(fs, 'closeSync');
    $$.SANDBOX.stub(fs, 'openSync');
    toolingRequestStub.onFirstCall().resolves(logs[0]);
    toolingRequestStub.onSecondCall().resolves(logs[1]);
    await apexLogGet.getLogs({
      logId: '07WgsWfad',
      outputDir: filePath
    });
    expect(createStreamStub.calledWith(logsPath)).toBe(true);
  });

  it('should throw an error if numberOfLogs or logId are not given to getLogs', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('path', 'to', 'logs');
    await expect(apexLogGet.getLogs({ outputDir: filePath })).rejects.toThrow(
      'To retrieve logs, specify the log ID or the number of logs.'
    );
  });

  describe('getLogRecords', () => {
    it('should return log records given a specific number of logs', async () => {
      const numberOfLogs = 2;
      let apexLogQuery = `
        SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUser.Name,
          Operation, Request, StartTime, Status
        FROM ApexLog
        ORDER BY StartTime DESC
      `;
      apexLogQuery += ` LIMIT ${numberOfLogs}`;
      const queryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query')
        //@ts-ignore
        .resolves(rawLogResult);

      const logService = new LogService(mockConnection);
      const records = await logService.getLogRecords(numberOfLogs);
      expect(records).toEqual(logRecords);
      expect(records).toHaveLength(numberOfLogs);
      expect(queryStub.calledWith(apexLogQuery)).toBe(true);
    });

    it('should return all log records', async () => {
      const apexLogQuery = `
        SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUser.Name,
          Operation, Request, StartTime, Status
        FROM ApexLog
        ORDER BY StartTime DESC
      `;
      const queryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query')
        //@ts-ignore
        .resolves(rawLogResult);

      const logService = new LogService(mockConnection);
      const records = await logService.getLogRecords();
      expect(records).toEqual(logRecords);
      expect(queryStub.calledWith(apexLogQuery)).toBe(true);
    });
  });
});
