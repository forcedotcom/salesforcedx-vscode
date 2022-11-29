/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { expect } from 'chai';
import { Table } from '../../../src/output';

describe('Creating a Table string', () => {
  it('Should create a string with the correct formatting and number of Rows and Columns', () => {
    const expectedTable =
      '=== Sample Table\n' +
      'Column 1  Column 2\n' +
      '────────  ────────\n' +
      'test      test2   \n' +
      'test3     test4   \n';

    const rows = [
      { col1: 'test', col2: 'test2' },
      { col1: 'test3', col2: 'test4' }
    ];
    const cols = [
      { key: 'col1', label: 'Column 1' },
      { key: 'col2', label: 'Column 2' }
    ];

    const table = new Table().createTable(rows, cols, 'Sample Table');

    expect(table).to.eq(expectedTable);
  });

  it('Should set column width to length of the widest cell in that column', () => {
    const expectedTable =
      'Column 1                   Column 2\n' +
      '─────────────────────────  ────────\n' +
      'test making a long column  test2   \n' +
      'test3                      test4   \n';
    const rows = [
      { col1: 'test making a long column', col2: 'test2' },
      { col1: 'test3', col2: 'test4' }
    ];
    const cols = [
      { key: 'col1', label: 'Column 1' },
      { key: 'col2', label: 'Column 2' }
    ];

    const table = new Table().createTable(rows, cols);

    expect(table).to.eq(expectedTable);
  });

  it('Should correctly format a multiline cell', () => {
    const expectedTable =
      'Column 1  Column 2                   \n' +
      '────────  ───────────────────────────\n' +
      'test1     first line                 \n' +
      '          second line which is longer\n' +
      'test2     test3                      \n';
    const rows = [
      { col1: 'test1', col2: 'first line\nsecond line which is longer' },
      { col1: 'test2', col2: 'test3' }
    ];
    const cols = [
      { key: 'col1', label: 'Column 1' },
      { key: 'col2', label: 'Column 2' }
    ];

    const table = new Table().createTable(rows, cols);

    expect(table).to.eq(expectedTable);
  });

  it('Should throw an error if a row is missing the key of a given column', () => {
    const rows = [
      { col1: 'test', col2: 'test2' },
      { col1: 'test3', col2: 'test4' }
    ];
    const cols = [
      { key: 'col1', label: 'Column 1' },
      { key: 'col3', label: 'Column 2' }
    ];

    try {
      new Table().createTable(rows, cols);
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).to.be.eq('Row is missing the key col3');
      } else {
        fail('Expected an error');
      }
    }
  });
});
