/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { ApexLogGetOptions } from './types';
import { createFile, QueryResult } from '../common';
import { nls } from '../i18n';
import * as path from 'path';
import { AnyJson } from '@salesforce/ts-types';

const MAX_NUM_LOGS = 25;

export class LogService {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async getIdList(options: ApexLogGetOptions): Promise<string[]> {
    if (
      !(
        typeof options.logId === 'string' ||
        typeof options.numberOfLogs === 'number'
      )
    ) {
      throw new Error(nls.localize('missing_info_log_error'));
    }
    let logIdList: string[] = [];
    if (typeof options.numberOfLogs === 'number') {
      logIdList = await this.getLogIds(options.numberOfLogs);
    } else {
      logIdList.push(options.logId);
    }
    return logIdList;
  }

  // TODO: readableStream cannot be used until updates are made in jsforce and sfdx-core
  public async getLogs(options: ApexLogGetOptions): Promise<string[]> {
    const logIdList = await this.getIdList(options);
    const logPaths: string[] = [];
    const connectionRequests = logIdList.map(async id => {
      const url = `${this.connection.tooling._baseUrl()}/sobjects/ApexLog/${id}/Body`;
      const logRecord = await this.toolingRequest(url);
      if (options.outputDir) {
        const logPath = path.join(options.outputDir, `${id}.log`);
        logPaths.push(logPath);
        createFile(logPath, logRecord);
      }
      return JSON.stringify(logRecord);
    });

    const logs = await Promise.all(connectionRequests);
    if (logPaths.length > 0) {
      return logPaths;
    }
    return logs;
  }

  public async getLogIds(numberOfLogs: number): Promise<string[]> {
    if (numberOfLogs <= 0) {
      throw new Error(nls.localize('num_logs_error'));
    }
    numberOfLogs = Math.min(numberOfLogs, MAX_NUM_LOGS);
    const query = `Select Id from ApexLog Order By StartTime DESC LIMIT ${numberOfLogs}`;
    const response = (await this.connection.tooling.query(
      query
    )) as QueryResult;
    return response.records.map(record => record.Id);
  }

  public async toolingRequest(url: string): Promise<AnyJson> {
    const log = (await this.connection.tooling.request(url)) as AnyJson;
    return log;
  }
}
