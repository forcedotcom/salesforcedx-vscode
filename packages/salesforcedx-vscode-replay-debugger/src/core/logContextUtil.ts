/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';

export class LogContextUtil {
  public readLogFile(logFilePath: string): string[] {
    try {
      return fs.readFileSync(logFilePath, 'utf-8').split(/\r?\n/);
    } catch (e) {
      return [];
    }
  }

  public stripBrackets(value: string): string {
    return value.replace('[', '').replace(']', '');
  }
}
