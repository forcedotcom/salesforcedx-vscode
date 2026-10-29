/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
import { type CommonOptions } from '../utils';

/** Established CLI projection, including LogUser attributes. */
export const LogRecordSchema = Schema.Struct({
  Id: Schema.String,
  Application: Schema.String,
  DurationMilliseconds: Schema.Number,
  Location: Schema.String,
  LogLength: Schema.Number,
  LogUser: Schema.Struct({
    attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    Name: Schema.String
  }),
  Operation: Schema.String,
  Request: Schema.String,
  StartTime: Schema.String,
  Status: Schema.String
}).annotations({ identifier: 'LogRecord' });

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

export type LogResult = {
  logPath?: string;
  log: string;
};
