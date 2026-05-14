/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Order from 'effect/Order';

export type SourceTrackingCounts = {
  local: number;
  remote: number;
  conflicts: number;
};

export type SourceTrackingDetails = {
  localChanges: StatusOutputRow[];
  remoteChanges: StatusOutputRow[];
  conflicts: StatusOutputRow[];
};

const statusRowOrder = Order.combine(
  Order.mapInput(Order.string, (row: StatusOutputRow) => row.type.toLowerCase()),
  Order.mapInput(Order.string, (row: StatusOutputRow) => row.fullName.toLowerCase())
);

const byConflict = Order.reverse(Order.mapInput(Order.boolean, (row: StatusOutputRow) => row.conflict ?? false));

/** Deduplicate status rows by fullName and type, filtering ignored rows and prioritizing conflicts */
export const dedupeStatus = (status: StatusOutputRow[]): StatusOutputRow[] => {
  const seen = new Set<string>();
  return status
    .filter(row => !row.ignored)
    .toSorted(byConflict)
    .filter(row => {
      const key = `${row.fullName}:${row.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const classifyRow = (row: StatusOutputRow): keyof SourceTrackingDetails =>
  row.conflict ? 'conflicts' : row.origin === 'local' ? 'localChanges' : 'remoteChanges';

const separateChangesByOriginAndConflict = (status: StatusOutputRow[]): SourceTrackingDetails => {
  const grouped = Object.groupBy(status, classifyRow);
  return {
    localChanges: grouped.localChanges ?? [],
    remoteChanges: grouped.remoteChanges ?? [],
    conflicts: grouped.conflicts ?? []
  };
};

/** Calculate counts from status output rows */
export const calculateCounts = (status: StatusOutputRow[]): SourceTrackingCounts => {
  const { localChanges, remoteChanges, conflicts } = separateChangesByOriginAndConflict(status);
  return { local: localChanges.length, remote: remoteChanges.length, conflicts: conflicts.length };
};

/** Separate changes by origin and conflict status, then sort by type and name */
export const separateChanges = (status: StatusOutputRow[]): SourceTrackingDetails => {
  const { localChanges, remoteChanges, conflicts } = separateChangesByOriginAndConflict(status);
  return {
    localChanges: localChanges.toSorted(statusRowOrder),
    remoteChanges: remoteChanges.toSorted(statusRowOrder),
    conflicts: conflicts.toSorted(statusRowOrder)
  };
};
