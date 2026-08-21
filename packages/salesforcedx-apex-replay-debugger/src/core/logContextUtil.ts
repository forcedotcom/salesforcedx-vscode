/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const EXEC_ANON_HEADER_PREFIX = 'Execute Anonymous: ';

/**
 * Extracts the anonymous Apex source lines embedded in a debug log.
 * Returns the source as a string if the log contains Execute Anonymous headers,
 * or undefined if it does not.
 */
export const extractAnonApexSource = (logContents: string): string | undefined => {
  const lines = logContents.split(/\r?\n/);
  const sourceLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(EXEC_ANON_HEADER_PREFIX)) {
      sourceLines.push(line.slice(EXEC_ANON_HEADER_PREFIX.length));
    } else if (sourceLines.length > 0) {
      // Headers are always contiguous at the top of the log; stop at the first non-header line
      break;
    }
  }
  return sourceLines.length > 0 ? sourceLines.join('\n') : undefined;
};

export class LogContextUtil {
  public getFileSizeFromContents(contents: string): number {
    return contents.length;
  }

  public readLogFileFromContents(contents: string): string[] {
    if (!contents || contents.trim() === '') {
      return [];
    }
    return contents
      .trim()
      .split(/\r?\n/)
      .map(line => line.trim());
  }

  public stripBrackets(value: string): string {
    return value.replace('[', '').replace(']', '');
  }

  public substringUpToLastPeriod(value: string): string {
    return value.substring(0, value.lastIndexOf('.'));
  }

  public substringFromLastPeriod(value: string): string {
    const valueSplit = value.split('.');
    return valueSplit.length > 1 ? valueSplit.at(-1)! : value;
  }

  public surroundBlobsWithQuotes(value: string): string {
    return value.replaceAll(/(BLOB\(\d+ bytes\))/g, '"$1"');
  }

  public removeQuotesFromBlob(value: string): string {
    return value.replaceAll(/'(BLOB\(\d+ bytes\))'/g, '$1');
  }
}
