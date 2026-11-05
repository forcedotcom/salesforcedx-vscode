/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { messages } from '../i18n/i18n';
import { createTable, type Row } from '../utils/table';

export const formatTestTable = (
  rows: Row[],
  title: string,
  showCategory: boolean,
  detailedCoverage: boolean = false
): string =>
  rows.length > 0
    ? createTable(
        rows,
        [
          { key: 'name', label: messages.testNameColHeader },
          ...(detailedCoverage ? [{ key: 'coveredClassName', label: messages.classTestedHeader }] : []),
          ...(showCategory ? [{ key: 'category', label: messages.categoryColHeader }] : []),
          { key: 'outcome', label: messages.outcomeColHeader },
          ...(detailedCoverage ? [{ key: 'coveredClassPercentage', label: messages.percentColHeader }] : []),
          { key: 'msg', label: messages.msgColHeader },
          { key: 'runtime', label: messages.runtimeColHeader }
        ],
        title
      )
    : '';
