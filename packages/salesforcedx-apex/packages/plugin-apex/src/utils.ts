/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as chalk from 'chalk';

export const colorSuccess = chalk.bold.green;
export const colorError = chalk.bold.red;

export const resultFormat = ['human', 'tap', 'junit', 'json'];
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

const colorMap = new Map([
  [new RegExp(/\b([\w]+\.)+(\w)+\b/g), chalk.blueBright],
  [new RegExp(/\b(DEBUG)\b/g), chalk.bold.cyan],
  [new RegExp(/\b(HINT|INFO|INFORMATION)\b/g), chalk.bold.green],
  [new RegExp(/\b(WARNING|WARN)\b/g), chalk.bold.yellow],
  [new RegExp(/\b(ERROR|FAILURE|FAIL)\b/g), chalk.bold.red],
  [new RegExp(/\b([a-zA-Z.]*Exception)\b/g), chalk.bold.red],
  [new RegExp(/"[^"]*"/g), chalk.bold.red],
  [new RegExp(/\b([0-9]+|true|false|null)\b/g), chalk.blueBright]
]);

function replace(regex: RegExp, word: string): string {
  const color = colorMap.get(regex);
  if (!color) {
    throw new Error('Error retrieving colors');
  }
  const result = word.replace(regex, match => {
    return `${color(match)}`;
  });
  return result;
}

export function colorLogs(log: string): string {
  for (const c of colorMap.keys()) {
    log = replace(c, log);
  }
  return log;
}
