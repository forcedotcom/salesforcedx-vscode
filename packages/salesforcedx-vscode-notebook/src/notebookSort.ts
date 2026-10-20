/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const LAST_EDITED_AT_METADATA = 'lastEditedAt';
export const LAST_RUN_AT_METADATA = 'lastRunAt';

export type RecencySortKey = 'lastEditedAt' | 'lastRunAt';

export type SortableCell = {
  index: number;
  kind: number;
  metadata?: { [key: string]: unknown };
};

export type CellGroup = {
  start: number;
  end: number;
  sortValue: number;
};

const MARKUP = 1;
const CODE = 2;

export const readTimestamp = (metadata: { [key: string]: unknown } | undefined, key: RecencySortKey): number => {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export const withTimestamp = (
  metadata: { [key: string]: unknown } | undefined,
  key: RecencySortKey,
  timestamp: number
): { [key: string]: unknown } => ({
  ...metadata,
  [key]: timestamp
});

export const groupSoqlPairs = (cells: readonly SortableCell[], key: RecencySortKey): CellGroup[] => {
  const groups: CellGroup[] = [];
  let index = 0;
  while (index < cells.length) {
    const cell = cells[index];
    if (cell.kind === CODE) {
      groups.push({ start: index, end: index + 1, sortValue: readTimestamp(cell.metadata, key) });
      index += 1;
      continue;
    }
    if (cell.kind === MARKUP && cells[index + 1]?.kind === CODE) {
      groups.push({
        start: index,
        end: index + 2,
        sortValue: readTimestamp(cells[index + 1].metadata, key)
      });
      index += 2;
      continue;
    }
    groups.push({ start: index, end: index + 1, sortValue: Number.NEGATIVE_INFINITY });
    index += 1;
  }
  return groups;
};

export const sortedGroupOrder = (groups: readonly CellGroup[]): number[] =>
  groups
    .map((group, originalIndex) => ({ group, originalIndex }))
    .toSorted((left, right) => {
      if (right.group.sortValue !== left.group.sortValue) {
        return right.group.sortValue - left.group.sortValue;
      }
      return left.originalIndex - right.originalIndex;
    })
    .map(({ originalIndex }) => originalIndex);

export const reorderCellsByGroups = <T>(cells: readonly T[], groups: readonly CellGroup[]): T[] =>
  sortedGroupOrder(groups).flatMap(groupIndex => cells.slice(groups[groupIndex].start, groups[groupIndex].end));

export type CellMove = {
  from: number;
  to: number;
  count: number;
};

export const cellMovesForSortedGroups = (groups: readonly CellGroup[]): CellMove[] => {
  const order = sortedGroupOrder(groups);
  const current = groups.map(group => ({ start: group.start, count: group.end - group.start }));
  return order.flatMap((groupIndex, destinationIndex) => {
    const from = current[groupIndex].start;
    const count = current[groupIndex].count;
    const to = order.slice(0, destinationIndex).reduce((sum, placed) => sum + current[placed].count, 0);
    if (from === to) {
      return [];
    }
    current.forEach(group => {
      if (from < to) {
        if (group.start > from && group.start < to + count) {
          group.start -= count;
        }
      } else if (group.start >= to && group.start < from) {
        group.start += count;
      }
    });
    current[groupIndex].start = to;
    return [{ from, to, count }];
  });
};
