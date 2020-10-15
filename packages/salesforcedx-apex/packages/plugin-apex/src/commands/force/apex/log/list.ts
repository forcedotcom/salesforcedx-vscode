/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogService } from '@salesforce/apex-node';
import { LogRecord } from '@salesforce/apex-node/lib/src/logs/types';
import { Table, Row } from '@salesforce/apex-node/lib/src/utils';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, Org } from '@salesforce/core';
import { buildDescription, logLevels } from '../../../../utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'list');

export default class List extends SfdxCommand {
  protected static requiresUsername = true;
  protected org!: Org;

  public static description = buildDescription(
    messages.getMessage('commandDescription'),
    messages.getMessage('longDescription')
  );

  public static longDescription = messages.getMessage('longDescription');
  public static examples = [
    `$ sfdx force:apex:log:list`,
    `$ sfdx force:apex:log:list -u me@my.org`
  ];

  protected static flagsConfig = {
    json: flags.boolean({
      description: messages.getMessage('jsonDescription')
    }),
    loglevel: flags.enum({
      description: messages.getMessage('logLevelDescription'),
      longDescription: messages.getMessage('logLevelLongDescription'),
      default: 'warn',
      options: logLevels
    }),
    apiversion: flags.builtin()
  };

  public async run(): Promise<LogRecord[]> {
    try {
      const conn = this.org.getConnection();
      const logService = new LogService(conn);
      const logRecords = await logService.getLogRecords();

      if (logRecords.length === 0) {
        this.ux.log(messages.getMessage('no_debug_logs_found'));
        return [];
      }

      const cleanLogs = this.cleanRecords(logRecords);
      const table = this.formatTable(cleanLogs);
      this.ux.log(table);

      return logRecords;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public formatTable(logRecords: LogRecord[]): string {
    const tb = new Table();
    const logRowArray: Row[] = [];

    for (const logRecord of logRecords) {
      const row: Row = {
        app: logRecord.Application,
        duration: String(logRecord.DurationMilliseconds),
        id: logRecord.Id,
        location: logRecord.Location,
        size: String(logRecord.LogLength),
        user: logRecord.LogUser.Name,
        operation: logRecord.Operation,
        request: logRecord.Request,
        time: logRecord.StartTime,
        status: logRecord.Status
      };
      logRowArray.push(row);
    }

    const tableResult = tb.createTable(logRowArray, [
      {
        key: 'app',
        label: messages.getMessage('app_col_header')
      },
      {
        key: 'duration',
        label: messages.getMessage('duration_col_header')
      },
      {
        key: 'id',
        label: messages.getMessage('id_col_header')
      },
      {
        key: 'location',
        label: messages.getMessage('location_col_header')
      },
      {
        key: 'size',
        label: messages.getMessage('size_col_header')
      },
      {
        key: 'user',
        label: messages.getMessage('user_col_header')
      },
      {
        key: 'operation',
        label: messages.getMessage('operation_col_header')
      },
      {
        key: 'request',
        label: messages.getMessage('request_col_header')
      },
      {
        key: 'time',
        label: messages.getMessage('time_col_header')
      },
      {
        key: 'status',
        label: messages.getMessage('status_col_header')
      }
    ]);
    return tableResult;
  }

  private cleanRecords(logRecords: LogRecord[]): LogRecord[] {
    return logRecords.map(record => {
      record.StartTime = this.formatTime(record.StartTime);
      return record;
    });
  }

  private formatTime(time: string): string {
    const milliIndex = time.indexOf('.');
    if (milliIndex !== -1) {
      return time.substring(0, milliIndex) + time.substring(milliIndex + 4);
    }
    return time;
  }
}
