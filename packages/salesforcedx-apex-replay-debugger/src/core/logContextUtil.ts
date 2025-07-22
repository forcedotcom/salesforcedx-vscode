/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
    return value.replace(/(BLOB\(\d+ bytes\))/g, '"$1"');
  }

  public removeQuotesFromBlob(value: string): string {
    return value.replace(/'(BLOB\(\d+ bytes\))'/g, '$1');
  }
}
