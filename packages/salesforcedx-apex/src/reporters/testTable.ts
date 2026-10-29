/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '../i18n';
import { type Row, Table } from '../utils';

export const formatTestTable = (
  rows: Row[],
  title: string,
  showCategory: boolean,
  detailedCoverage: boolean = false
): string =>
  rows.length > 0
    ? new Table().createTable(
        rows,
        [
          { key: 'name', label: nls.localize('testNameColHeader') },
          ...(detailedCoverage ? [{ key: 'coveredClassName', label: nls.localize('classTestedHeader') }] : []),
          ...(showCategory ? [{ key: 'category', label: nls.localize('categoryColHeader') }] : []),
          { key: 'outcome', label: nls.localize('outcomeColHeader') },
          ...(detailedCoverage ? [{ key: 'coveredClassPercentage', label: nls.localize('percentColHeader') }] : []),
          { key: 'msg', label: nls.localize('msgColHeader') },
          { key: 'runtime', label: nls.localize('runtimeColHeader') }
        ],
        title
      )
    : '';
