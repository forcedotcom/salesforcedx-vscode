/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Connection,
  Logger,
  Org,
  StatusResult,
  StreamingClient
} from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { AnyJson } from '@salesforce/ts-types';
import {
  MAX_NUM_LOGS,
  LOG_TIMER_LENGTH_MINUTES,
  LISTENER_ABORTED_ERROR_NAME
} from './constants';
import {
  ApexLogGetOptions,
  LogQueryResult,
  LogRecord,
  LogResult
} from './types';
import * as path from 'path';
import { nls } from '../i18n';
import { createFile } from '../utils';
import { TraceFlags } from '../utils/traceFlags';

type StreamingLogMessage = {
  sobject: { Id: string };
};

const STREAMING_LOG_TOPIC = '/systemTopic/Logging';

export class LogService {
  public readonly connection: Connection;
  private logger: Logger;
  private logTailer?: (log: string) => void;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async getLogIds(options: ApexLogGetOptions): Promise<string[]> {
    if (
      !(
        typeof options.logId === 'string' ||
        typeof options.numberOfLogs === 'number'
      )
    ) {
      throw new Error(nls.localize('missingInfoLogError'));
    }

    if (typeof options.numberOfLogs === 'number') {
      const logIdRecordList = await this.getLogRecords(options.numberOfLogs);
      return logIdRecordList.map(logRecord => logRecord.Id);
    }
    return [options.logId];
  }

  // TODO: readableStream cannot be used until updates are made in jsforce and sfdx-core
  public async getLogs(options: ApexLogGetOptions): Promise<LogResult[]> {
    const logIdList = await this.getLogIds(options);
    const logPaths: string[] = [];
    const connectionRequests = logIdList.map(async id => {
      const url = `${this.connection.tooling._baseUrl()}/sobjects/ApexLog/${id}/Body`;
      const logRecord = await this.toolingRequest(url);
      if (options.outputDir) {
        const logPath = path.join(options.outputDir, `${id}.log`);
        logPaths.push(logPath);
        createFile(logPath, logRecord);
      }
      return String(logRecord);
    });

    const logs = await Promise.all(connectionRequests);
    if (logPaths.length > 0) {
      const logMap: LogResult[] = [];
      for (let i = 0; i < logs.length; i++) {
        logMap.push({ log: logs[i], logPath: logPaths[i] });
      }
      return logMap;
    }

    return logs.map(log => {
      return { log };
    });
  }

  public async getLogById(logId: string): Promise<LogResult> {
    const baseUrl = this.connection.tooling._baseUrl();
    const url = `${baseUrl}/sobjects/ApexLog/${logId}/Body`;
    const response = (await this.connection.tooling.request(url)) as AnyJson;
    return { log: response.toString() || '' };
  }

  public async getLogRecords(numberOfLogs?: number): Promise<LogRecord[]> {
    let apexLogQuery = `
        SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUser.Name,
          Operation, Request, StartTime, Status
        FROM ApexLog
        ORDER BY StartTime DESC
      `;

    if (typeof numberOfLogs === 'number') {
      if (numberOfLogs <= 0) {
        throw new Error(nls.localize('numLogsError'));
      }
      numberOfLogs = Math.min(numberOfLogs, MAX_NUM_LOGS);
      apexLogQuery += ` LIMIT ${numberOfLogs}`;
    }

    const response = (await this.connection.tooling.query(
      apexLogQuery
    )) as LogQueryResult;
    return response.records as LogRecord[];
  }

  public async tail(org: Org, tailer?: (log: string) => void): Promise<void> {
    this.logger = await Logger.child('apexLogApi', { tag: 'tail' });
    this.logTailer = tailer;
    const options = new StreamingClient.DefaultOptions(
      org,
      STREAMING_LOG_TOPIC,
      this.streamingCallback.bind(this)
    );
    options.setSubscribeTimeout(Duration.minutes(LOG_TIMER_LENGTH_MINUTES));

    const stream = await StreamingClient.create(options);

    this.logger.debug('Attempting StreamingClient handshake');
    await stream.handshake();
    this.logger.debug('Finished StreamingClient handshake');

    await stream.subscribe(async () => {
      this.logger.debug('Subscribing to ApexLog events');
    });
  }

  private async logCallback(message: StreamingLogMessage): Promise<void> {
    if (message.sobject && message.sobject.Id) {
      const log = await this.getLogById(message.sobject.Id);
      if (log && this.logTailer) {
        this.logTailer(log.log);
      }
    }
  }

  private streamingCallback(message: any): StatusResult {
    if (message.errorName === LISTENER_ABORTED_ERROR_NAME) {
      return { completed: true };
    }

    if (message.sobject?.Id) {
      this.logCallback(message);
    }

    return { completed: false };
  }

  public async prepareTraceFlag(requestedDebugLevel: string): Promise<void> {
    const flags = new TraceFlags(this.connection);
    await flags.ensureTraceFlags(requestedDebugLevel);
  }

  public async toolingRequest(url: string): Promise<AnyJson> {
    const log = (await this.connection.tooling.request(url)) as AnyJson;
    return log;
  }
}
