/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile, stat } from '@salesforce/salesforcedx-utils-vscode';

export class LogContextUtil {
  public async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  public async readLogFile(logFilePath: string): Promise<string[]> {
    try {
      const content = await readFile(logFilePath);
      return content.trim().split(/\r?\n/);
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
    return valueSplit.length > 1 ? valueSplit[valueSplit.length - 1] : value;
  }

  public surroundBlobsWithQuotes(value: string): string {
    return value.replace(/(BLOB\(\d+ bytes\))/g, '"$1"');
  }

  public removeQuotesFromBlob(value: string): string {
    return value.replace(/'(BLOB\(\d+ bytes\))'/g, '$1');
  }
}
