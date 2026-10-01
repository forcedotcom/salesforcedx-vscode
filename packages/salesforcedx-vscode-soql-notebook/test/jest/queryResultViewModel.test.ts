/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { toQueryResultViewModel } from '../../src/queryResultViewModel';

describe('query result view model', () => {
  it('adds SelectAnalyzer column data for a simple query', () => {
    const payload = { totalSize: 1, done: true, records: [{ Id: '001' }] };

    expect(toQueryResultViewModel('SELECT Id FROM Account', payload)).toEqual({
      ...payload,
      queryText: 'SELECT Id FROM Account',
      columnData: {
        objectName: 'Account',
        columns: [{ title: 'Id', fieldHelper: ['Id'] }],
        subTables: []
      }
    });
  });

  it('keeps subquery metadata as nested tables', () => {
    const model = toQueryResultViewModel('SELECT Name, (SELECT Id FROM Contacts) FROM Account', {
      totalSize: 1,
      done: true,
      records: []
    });

    expect(model.columnData.subTables).toEqual([
      {
        objectName: 'Contacts',
        columns: [{ title: 'Contacts.Id', fieldHelper: ['Id'] }],
        subTables: []
      }
    ]);
  });
});
