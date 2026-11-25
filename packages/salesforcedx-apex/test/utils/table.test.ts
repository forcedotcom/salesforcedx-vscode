/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createTable } from '../../src/utils/table';

describe('Table Utils', () => {
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

    const table = createTable(rows, cols, 'Sample Table');

    expect(table).toBe(expectedTable);
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

    const table = createTable(rows, cols);

    expect(table).toBe(expectedTable);
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

    const table = createTable(rows, cols);

    expect(table).toBe(expectedTable);
  });

  it('Should correctly format another multiline cell', () => {
    const expectedTable = [
      'Column 1  Column 2                    Column 3',
      '────────  ──────────────────────────  ────────',
      `${'test1'.padEnd(8)}  ${'first line which is longer'.padEnd(26)}  ${'value1'.padEnd(8)}`,
      `${' '.repeat(8)}  ${'second line'.padEnd(26)}  ${' '.repeat(8)}`,
      `${'test2'.padEnd(8)}  ${'test3'.padEnd(26)}  ${'value2'.padEnd(8)}`,
      ''
    ].join('\n');
    const rows = [
      {
        col1: 'test1',
        col2: 'first line which is longer\nsecond line',
        col3: 'value1'
      },
      { col1: 'test2', col2: 'test3', col3: 'value2' }
    ];
    const cols = [
      { key: 'col1', label: 'Column 1' },
      { key: 'col2', label: 'Column 2' },
      { key: 'col3', label: 'Column 3' }
    ];

    const table = createTable(rows, cols);

    expect(table).toBe(expectedTable);
  });

  it('Should leave a cell blank if the row is missing a column key', () => {
    const rows = [
      { col1: 'test', col2: 'test2' },
      { col1: 'test3', col2: 'test4' }
    ];
    const cols = [
      { key: 'col1', label: 'Column 1' },
      { key: 'col3', label: 'Column 2' }
    ];

    expect(createTable(rows, cols)).toBe(
      [
        'Column 1  Column 2',
        '────────  ────────',
        `${'test'.padEnd(8)}  ${' '.repeat(8)}`,
        `${'test3'.padEnd(8)}  ${' '.repeat(8)}`,
        ''
      ].join('\n')
    );
  });
});
