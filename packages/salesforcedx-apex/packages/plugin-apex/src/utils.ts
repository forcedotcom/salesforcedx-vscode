/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as chalk from 'chalk';

export const colorSuccess = chalk.bold.green;
export const colorError = chalk.bold.red;

export const logLevels = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'TRACE',
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL'
];

export function buildDescription(
  shortDescription: string,
  longDescription: string
): string {
  return `${shortDescription}\n${longDescription}`;
}
