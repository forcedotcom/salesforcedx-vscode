/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SinonStub } from 'sinon';
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as fs from 'node:fs/promises';
import { LogService } from '../../src/logs/logService';
import * as path from 'node:path';
import { type LogRecord, type LogResult } from '../../src/logs/types';

vi.mock(import('node:fs/promises'), () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));

type LogQueryResult = {
  records: LogRecord[];
};

const logRecords: LogRecord[] = [
  {
    Id: '07L5tg0005PGdTnEAL',
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
    Id: '07L5tg0005PGdTnFPL',
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
      Id: '07L5tg0005PGdTnEAL',
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
      Id: '07L5tg0005PGdTnFPL',
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
    vi.mocked(fs.mkdir).mockReset();
    vi.mocked(fs.writeFile).mockReset();
    await $$.stubAuths(testData);

    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    toolingRequestStub = $$.SANDBOX.stub(mockConnection.tooling, 'request');
  });

  it('should return correct number of logs', async () => {
    const apexLogGet = new LogService(mockConnection);
    const logs = ['07WgsWfsFF', 'FTWrd5lfg'];
    const ids = logRecords;
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
      { Id: '07L000000000001AAA' },
      { Id: '07L000000000002AAA' },
      { Id: '07L000000000003AAA' },
      { Id: '07L000000000004AAA' },
      { Id: '07L000000000005AAA' },
      { Id: '07L000000000006AAA' },
      { Id: '07L000000000007AAA' },
      { Id: '07L000000000008AAA' },
      { Id: '07L000000000009AAA' },
      { Id: '07L000000000010AAA' },
      { Id: '07L000000000011AAA' },
      { Id: '07L000000000012AAA' },
      { Id: '07L000000000013AAA' },
      { Id: '07L000000000014AAA' },
      { Id: '07L000000000015AAA' },
      { Id: '07L000000000016AAA' },
      { Id: '07L000000000017AAA' },
      { Id: '07L000000000018AAA' },
      { Id: '07L000000000019AAA' },
      { Id: '07L000000000020AAA' },
      { Id: '07L000000000021AAA' },
      { Id: '07L000000000022AAA' },
      { Id: '07L000000000023AAA' },
      { Id: '07L000000000024AAA' },
      { Id: '07L000000000025AAA' }
    ];
    const queryRecords = { records: ids.map(item => ({ ...logRecords[0], ...item })), done: true, totalSize: ids.length };
    const toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingQueryStub.onFirstCall().resolves(queryRecords);

    toolingRequestStub.resolves('log');
    const response = await apexLogGet.getLogs({
      numberOfLogs: 27
    });
    expect(response).toHaveLength(25);
  });

  it('should handle invalid id', async () => {
    const apexLogGet = new LogService(mockConnection);
    toolingRequestStub.throws(new Error('invalid id'));
    await expect(apexLogGet.getLogs({ logId: '07L5tg0005PGdTnEAL' })).rejects.toThrow('invalid id');
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
    $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({ records: logRecords, done: true, totalSize: 2 });

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
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledWith(logResult[0].logPath, logs[0]);
    expect(fs.mkdir).toHaveBeenCalledWith(filePath, { recursive: true });
  });

  it('should successfully create a .log file', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('path', 'to', 'logs');
    const logIds = ['07L000000000001AAA'];
    const logs = ['log content'];
    const logsPath = path.join(filePath, `${logIds[0]}.log`);
    toolingRequestStub.onFirstCall().resolves(logs[0]);
    toolingRequestStub.onSecondCall().resolves(logs[1]);
    await apexLogGet.getLogs({
      logId: '07L000000000001AAA',
      outputDir: filePath
    });
    expect(fs.writeFile).toHaveBeenCalledWith(logsPath, logs[0]);
  });

  it('should throw an error if numberOfLogs or logId are not given to getLogs', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join('path', 'to', 'logs');
    await expect(apexLogGet.getLogs({ outputDir: filePath })).rejects.toThrow(
      'To retrieve logs, specify the log ID or the number of logs.'
    );
  });

  it('rejects failed file writes with a plain CLI error', async () => {
    const logService = new LogService(mockConnection);
    toolingRequestStub.resolves('body');
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('permission denied'));
    await expect(logService.getLogs({ logId: '07L5tg0005PGdTnEAL', outputDir: 'logs' })).rejects.toThrow(/^permission denied$/);
  });

  describe('getLogRecords', () => {
    it('should return log records given a specific number of logs', async () => {
      const numberOfLogs = 2;
      const apexLogQuery = `SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, LogUser.Name, Operation, Request, StartTime, Status FROM ApexLog ORDER BY StartTime DESC, Id DESC LIMIT ${numberOfLogs}`;
      const queryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query')
        //@ts-ignore
        .resolves({ records: rawLogResult.records.map(record => ({ ...record, LogUserId: '005000000000001AAA' })) });

      const logService = new LogService(mockConnection);
      const records = await logService.getLogRecords(numberOfLogs);
      expect(records).toEqual(logRecords);
      expect(records).toHaveLength(numberOfLogs);
      expect(queryStub.calledWith(apexLogQuery)).toBe(true);
    });

    it('should return all log records', async () => {
      const apexLogQuery = 'SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, LogUser.Name, Operation, Request, StartTime, Status FROM ApexLog ORDER BY StartTime DESC, Id DESC';
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
