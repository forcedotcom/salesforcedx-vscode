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
import type { AnyJson } from '@salesforce/ts-types';
import {
  LISTENER_ABORTED_ERROR_NAME,
  LOG_TIMER_LENGTH_MINUTES,
  MAX_NUM_LOGS,
  STREAMING_LOG_TOPIC
} from './constants';
import { ApexLogGetOptions, LogRecord, LogResult } from './types';
import * as path from 'path';
import { nls } from '../i18n';
import { createFile } from '../utils';
import { TraceFlags } from '../utils/traceFlags';
import { elapsedTime } from '../utils/elapsedTime';

type StreamingLogMessage = {
  errorName?: string;
  sobject: { Id: string };
};

export class LogService {
  public readonly connection: Connection;
  private logger: Logger;
  private logTailer?: (log: string) => void;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  @elapsedTime()
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
      return logIdRecordList.map((logRecord) => logRecord.Id);
    }
    return [options.logId];
  }

  // TODO: readableStream cannot be used until updates are made in jsforce and sfdx-core
  @elapsedTime()
  public async getLogs(options: ApexLogGetOptions): Promise<LogResult[]> {
    const logs = (
      await Promise.all(
        (await this.getLogIds(options)).map(async (id) => ({
          ...(await this.getLogById(id)),
          logId: id
        }))
      )
    ).map(({ log, logId }) => {
      if (options.outputDir) {
        const logPath = path.join(options.outputDir, `${logId}.log`);
        createFile(logPath, log);
        return { log, logPath };
      }
      return { log };
    });

    return logs;
  }

  @elapsedTime()
  public async getLogById(logId: string): Promise<LogResult> {
    const baseUrl = this.connection.tooling._baseUrl();
    const url = `${baseUrl}/sobjects/ApexLog/${logId}/Body`;
    const response = await this.toolingRequest(url);
    return { log: response.toString() || '' };
  }

  @elapsedTime()
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

    return (await this.connection.tooling.query<LogRecord>(apexLogQuery))
      .records;
  }

  @elapsedTime()
  public async tail(org: Org, tailer?: (log: string) => void): Promise<void> {
    this.logger = await Logger.child('apexLogApi', { tag: 'tail' });
    this.logTailer = tailer;
    const stream = await this.createStreamingClient(org);

    this.logger.debug(nls.localize('startHandshake'));
    await stream.handshake();
    this.logger.debug(nls.localize('finishHandshake'));
    await stream.subscribe(async () => {
      this.logger.debug(nls.localize('subscribeStarted'));
    });
  }

  @elapsedTime()
  public async createStreamingClient(org: Org): Promise<StreamingClient> {
    const options = new StreamingClient.DefaultOptions(
      org,
      STREAMING_LOG_TOPIC,
      this.streamingCallback.bind(this)
    );
    options.setSubscribeTimeout(Duration.minutes(LOG_TIMER_LENGTH_MINUTES));

    return await StreamingClient.create(options);
  }

  @elapsedTime()
  public async logCallback(message: StreamingLogMessage): Promise<void> {
    if (message.sobject?.Id) {
      const log = await this.getLogById(message.sobject.Id);
      if (log && this.logTailer) {
        this.logTailer(log.log);
      }
    }
  }

  @elapsedTime()
  private streamingCallback(message: StreamingLogMessage): StatusResult {
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

  @elapsedTime()
  public async toolingRequest(url: string): Promise<AnyJson> {
    const log = (await this.connection.tooling.request(url)) as AnyJson;
    return log;
  }
}
