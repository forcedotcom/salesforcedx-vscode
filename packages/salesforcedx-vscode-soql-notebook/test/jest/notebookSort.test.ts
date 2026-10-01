/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { cellMovesForSortedGroups, groupSoqlPairs, reorderCellsByGroups, SortableCell } from '../../src/notebookSort';

const cell = (kind: number, metadata?: { [key: string]: unknown }): SortableCell => ({
  index: 0,
  kind,
  metadata
});

describe('notebook recency sort', () => {
  it('keeps a markdown note with the following SOQL cell', () => {
    const cells = [
      cell(1),
      cell(2, { lastEditedAt: 10 }),
      cell(2, { lastEditedAt: 30 }),
      cell(1),
      cell(2, { lastEditedAt: 20 })
    ];

    expect(reorderCellsByGroups(cells, groupSoqlPairs(cells, 'lastEditedAt'))).toEqual([
      cell(2, { lastEditedAt: 30 }),
      cell(1),
      cell(2, { lastEditedAt: 20 }),
      cell(1),
      cell(2, { lastEditedAt: 10 })
    ]);
  });

  it('sorts by last run and leaves unpaired markdown in place relative to never-run cells', () => {
    const cells = [cell(1), cell(2, { lastRunAt: 5 }), cell(1)];

    expect(reorderCellsByGroups(cells, groupSoqlPairs(cells, 'lastRunAt')).map(item => item.kind)).toEqual([
      1, 2, 1
    ]);
  });

  it('keeps original order when timestamps match', () => {
    const cells = [cell(2, { lastEditedAt: 1 }), cell(2, { lastEditedAt: 1 })];
    expect(reorderCellsByGroups(cells, groupSoqlPairs(cells, 'lastEditedAt'))).toEqual(cells);
  });

  it('moves groups into recency order without rewriting cells', () => {
    const cells = [
      cell(1),
      cell(2, { lastEditedAt: 10 }),
      cell(2, { lastEditedAt: 30 }),
      cell(1),
      cell(2, { lastEditedAt: 20 })
    ];

    expect(cellMovesForSortedGroups(groupSoqlPairs(cells, 'lastEditedAt'))).toEqual([
      { from: 2, to: 0, count: 1 },
      { from: 3, to: 1, count: 2 }
    ]);
  });
});
