/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommonOptions } from '../utils';

export type ApexLogGetOptions = CommonOptions & {
  numberOfLogs?: number;
  logId?: string;
  outputDir?: string;
};

export interface LogRecord {
  Id: string;
  /**
   * Application type
   */
  Application: 'Unknown' | string;
  /**
   * Time to generate log
   */
  DurationMilliseconds: number;
  /**
   * Where the log was stored
   */
  Location: 'SystemLog' | string;
  /**
   * Length of the debug log
   */
  LogLength: number;
  /**
   * Name of the user who generated the log
   */
  LogUser: {
    attributes: {};
    Name: string;
  };
  /**
   * Type of operation
   */
  Operation: 'Api' | string;
  /**
   * Type of request
   */
  Request: 'Api' | string;
  /**
   * Time the log was generated
   */
  StartTime: string;
  /**
   * Status of the operation
   */
  Status: string;
}

export type LogQueryResult = {
  records: LogRecord[];
};

export type LogResult = {
  logPath?: string;
  log: string;
};
