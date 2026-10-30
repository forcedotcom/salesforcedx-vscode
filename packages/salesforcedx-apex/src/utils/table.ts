/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { elapsedTime } from './elapsedTime';
import { formatTable } from './formatTable';
import { type Column, type Row } from './types';

export class Table {
  @elapsedTime()
  public createTable(rows: Row[], cols: Column[], title?: string): string {
    return formatTable(rows, cols, title);
  }
}
