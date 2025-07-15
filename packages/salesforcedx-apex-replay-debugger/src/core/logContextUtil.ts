/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line no-restricted-imports
import * as fs from 'node:fs';

export class LogContextUtil {
  public getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  public readLogFile(logFilePath: string): string[] {
    try {
      return fs.readFileSync(logFilePath, 'utf-8').trim().split(/\r?\n/);
    } catch {
      return [];
    }
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
    return value.replace(/(BLOB\(\d+ bytes\))/g, '"$1"');
  }

  public removeQuotesFromBlob(value: string): string {
    return value.replace(/'(BLOB\(\d+ bytes\))'/g, '$1');
  }
}
