/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getColumns } from '../../src/queryResultColumns';
import { measuredTableHeight } from '../../src/tableHeight';

describe('query result columns', () => {
  it('maps SelectAnalyzer helpers onto the first record keys', () => {
    expect(
      getColumns(
        { totalSize: 1, done: true, records: [{ Id: '001', Name: 'Acme' }] },
        {
          objectName: 'Account',
          columns: [
            { title: 'Id', fieldHelper: ['Id'] },
            { title: 'Name', fieldHelper: ['Name'] }
          ],
          subTables: []
        }
      )
    ).toEqual([
      { title: 'Id', field: 'Id' },
      { title: 'Name', field: 'Name' }
    ]);
  });

  it('returns no columns when there are no records', () => {
    expect(
      getColumns(
        { totalSize: 0, done: true, records: [] },
        {
          objectName: 'Account',
          columns: [{ title: 'Id', fieldHelper: ['Id'] }],
          subTables: []
        }
      )
    ).toEqual([]);
  });
});

describe('measured table height', () => {
  it('fits short tables to measured content and caps tall ones', () => {
    expect(measuredTableHeight({ headerHeight: 28, rowsHeight: 24, footerHeight: 0 })).toBe(52);
    expect(measuredTableHeight({ headerHeight: 28, rowsHeight: 48, footerHeight: 0 })).toBe(76);
    expect(measuredTableHeight({ headerHeight: 28, rowsHeight: 400, footerHeight: 36 })).toBe(280);
  });
});
