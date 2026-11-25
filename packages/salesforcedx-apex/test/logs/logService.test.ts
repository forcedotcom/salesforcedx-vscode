/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SinonStub } from 'sinon';
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import type * as Schema from 'effect/Schema';
import type { ApexLogRecordSchema } from '../../src/effect/schema/wire/logs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { LogService } from '../../src/logs/logService';
import * as path from 'node:path';
import { type LogResult } from '../../src/logs/types';

type LogQueryResult = {
  records: Schema.Codec.Encoded<typeof ApexLogRecordSchema>[];
  done: true;
  totalSize: number;
};

const logRecords: Schema.Codec.Encoded<typeof ApexLogRecordSchema>[] = [
  {
    Id: '07L000000000001AAA',
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
    Id: '07L000000000002AAA',
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
  done: true,
  totalSize: 2,
  records: [
    {
      Id: '07L000000000001AAA',
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
      Id: '07L000000000002AAA',
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
  let requestStub: SinonStub;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'apex-log-output-'));
    await $$.stubAuths(testData);

    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    requestStub = $$.SANDBOX.stub();
    mockConnection.request = requestStub as unknown as typeof mockConnection.request;
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('should return correct number of logs', async () => {
    const apexLogGet = new LogService(mockConnection);
    const logs = ['first log', 'second log'];
    const queryRecords = { records: logRecords, done: true as const, totalSize: logRecords.length };
    requestStub.onFirstCall().resolves(logs[0]);
    requestStub.onSecondCall().resolves(logs[1]);
    const toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingQueryStub.onFirstCall().resolves(queryRecords);
    const response = await apexLogGet.getLogs({
      numberOfLogs: 2
    });
    expect(response).toHaveLength(2);
  });

  it('should return correct log given log id', async () => {
    const apexLogGet = new LogService(mockConnection);
    const log = '48.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT..';
    const toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    requestStub.onFirstCall().resolves(log);
    const response = await apexLogGet.getLogs({
      logId: '07L000000000001AAA'
    });
    expect(response).toHaveLength(1);
    expect(toolingQueryStub.notCalled).toBe(true);
  });

  it('should handle exceeding log limit', async () => {
    const apexLogGet = new LogService(mockConnection);
    const ids = Array.from({ length: 25 }, (_, index) => ({
      ...logRecords[0],
      Id: `07L${String(index).padStart(15, '0')}`
    }));
    const queryRecords = { records: ids, done: true, totalSize: ids.length };
    const toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingQueryStub.onFirstCall().resolves(queryRecords);
    requestStub.resolves('log');
    const response = await apexLogGet.getLogs({
      numberOfLogs: 27
    });
    expect(response).toHaveLength(25);
  });

  it('should handle invalid id', async () => {
    const apexLogGet = new LogService(mockConnection);
    requestStub.rejects(new Error('invalid id'));
    await expect(apexLogGet.getLogs({ logId: '07L000000000001AAA' })).rejects.toThrow(
      'Failed to fetch ApexLog body: invalid id'
    );
  });

  it('should throw an error if 0 logs are requested', async () => {
    const apexLogGet = new LogService(mockConnection);
    await expect(apexLogGet.getLogs({ numberOfLogs: 0 })).rejects.toThrow(
      'Expected number of logs to be greater than 0.'
    );
  });

  it('should store logs in the directory', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join(directory, 'logs');
    const toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves(rawLogResult);
    const logs = ['first log', 'second log'];
    requestStub.onFirstCall().resolves('first log');
    requestStub.onSecondCall().resolves('second log');

    const logResult: LogResult[] = [
      { log: 'first log', logPath: path.join(filePath, `${logRecords[0].Id}.log`) },
      { log: 'second log', logPath: path.join(filePath, `${logRecords[1].Id}.log`) }
    ];

    const response = await apexLogGet.getLogs({
      numberOfLogs: 2,
      outputDir: filePath
    });

    expect(response).toEqual(logResult);
    expect(toolingQueryStub.calledOnce).toBe(true);
    await expect(readdir(filePath)).resolves.toEqual(logRecords.map(record => `${record.Id}.log`).toSorted());
    await expect(
      Promise.all(logRecords.map(record => readFile(path.join(filePath, `${record.Id}.log`), 'utf8')))
    ).resolves.toEqual(logs);
  });

  it('should successfully create a .log file', async () => {
    const apexLogGet = new LogService(mockConnection);
    const filePath = path.join(directory, 'logs');
    const logId = '07L000000000001AAA';
    const logs = ['log content'];
    const logsPath = path.join(filePath, `${logId}.log`);
    requestStub.onFirstCall().resolves(logs[0]);
    await apexLogGet.getLogs({
      logId,
      outputDir: filePath
    });
    await expect(readFile(logsPath, 'utf8')).resolves.toBe(logs[0]);
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
      const apexLogQuery =
        'SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, LogUser.Name, Operation, Request, StartTime, Status FROM ApexLog ORDER BY StartTime DESC, Id DESC LIMIT 2';
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
      const apexLogQuery =
        'SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, LogUser.Name, Operation, Request, StartTime, Status FROM ApexLog ORDER BY StartTime DESC, Id DESC';
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
