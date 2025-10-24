/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Parses log file contents into an array of trimmed lines */
export const readLogFileFromContents = (contents: string): string[] => {
  if (!contents || contents.trim() === '') {
    return [];
  }
  return contents
    .trim()
    .split(/\r?\n/)
    .map(line => line.trim());
};

export const stripBrackets = (value: string): string => value.replace('[', '').replace(']', '');
export const substringUpToLastPeriod = (value: string): string => value.substring(0, value.lastIndexOf('.'));
export const substringFromLastPeriod = (value: string): string => value.split('.').at(-1) ?? value;
export const surroundBlobsWithQuotes = (value: string): string => value.replace(/(BLOB\(\d+ bytes\))/g, '"$1"');
export const removeQuotesFromBlob = (value: string): string => value.replace(/'(BLOB\(\d+ bytes\))'/g, '$1');
export const getFileSizeFromContents = (contents: string): number => contents.length;
