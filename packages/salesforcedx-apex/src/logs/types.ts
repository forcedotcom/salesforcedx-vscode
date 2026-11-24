/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexLogRecord } from '../effect/schema/wire/logs';
import { type CommonOptions } from '../utils/types';

export type ApexLogGetOptions = CommonOptions & {
  numberOfLogs?: number;
  logId?: string;
  outputDir?: string;
};

export type LogRecord = ApexLogRecord;

export type LogResult = {
  logPath?: string;
  log: string;
};
