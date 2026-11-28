/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type CommonOptions } from '../utils/types';

export type ApexLogGetOptions = CommonOptions & {
  numberOfLogs?: number;
  logId?: string;
  outputDir?: string;
};

export type LogRecord = {
  readonly Id: string;
  readonly Application?: string | null;
  readonly DurationMilliseconds?: number | null;
  readonly Location?: string | null;
  readonly LogLength: number;
  readonly LogUserId?: string | null;
  readonly LogUser?: {
    readonly Name?: string | null;
    readonly attributes?: Readonly<Record<string, string>>;
  };
  readonly Operation?: string | null;
  readonly Request?: string | null;
  readonly StartTime: string;
  readonly Status: string;
};

export type LogResult = {
  logPath?: string;
  log: string;
};
