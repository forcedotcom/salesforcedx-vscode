/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ApexLogGetOptions } from '../types/service';
import { QueryResult } from '../types/common';
import { nls } from '../i18n';

const MAX_NUM_LOGS = 25;

export class ApexLogGet {
  public readonly connection: Connection;
  constructor(connection: Connection) {
    this.connection = connection;
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

  public async execute(options: ApexLogGetOptions): Promise<string[]> {
    let logIdList: string[] = [];
    if (options.numberOfLogs) {
      logIdList = await this.getLogIds(options.numberOfLogs);
    } else {
      logIdList.push(options.logId);
    }

    const connectionRequests = logIdList.map(id => {
      const url = `${this.connection.tooling._baseUrl()}/sobjects/ApexLog/${id}/Body`;
      return this.connectionRequest(url);
    });
    return await Promise.all(connectionRequests);
  }

  public async connectionRequest(url: string): Promise<string> {
    const log = await this.connection.request(url);
    return JSON.stringify(log);
  }
}
