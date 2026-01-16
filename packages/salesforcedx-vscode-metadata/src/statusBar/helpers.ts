/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Order from 'effect/Order';
import * as vscode from 'vscode';

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

export const statusRowOrder = Order.combine(
  /** Sort by type (case-insensitive) */
  Order.mapInput(Order.string, (row: StatusOutputRow) => row.type.toLowerCase()),
  /** Sort by fullName (case-insensitive) */
  Order.mapInput(Order.string, (row: StatusOutputRow) => row.fullName.toLowerCase())
);

/** Sort by conflict status (conflicts first) */
const byConflict = Order.reverse(Order.mapInput(Order.boolean, (row: StatusOutputRow) => row.conflict ?? false));

/** Deduplicate status rows by fullName and type */
export const dedupeStatus = (status: StatusOutputRow[]): StatusOutputRow[] => {
  const seen = new Set<string>();
  return status
    .filter(row => !row.ignored)
    .toSorted(byConflict) // prioritize conflicts
    .filter(row => {
      const key = `${row.fullName}:${row.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

export const calculateBackground = (counts: SourceTrackingCounts): vscode.ThemeColor | undefined => {
  if (counts.conflicts > 0) {
    return new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (counts.local > 0 && process.env.ESBUILD_PLATFORM === 'web') {
    return new vscode.ThemeColor('statusBarItem.warningBackground');
  }
  return undefined;
};

const separateChangesByOriginAndConflict = (status: StatusOutputRow[]): SourceTrackingDetails => {
  const nonIgnored = status.filter(row => !row.ignored);
  const nonConflicts = nonIgnored.filter(row => !row.conflict);
  const localChanges = nonConflicts.filter(row => row.origin === 'local');
  const remoteChanges = nonConflicts.filter(row => row.origin === 'remote');
  const conflicts = nonIgnored.filter(row => row.conflict);
  return { localChanges, remoteChanges, conflicts };
};

/** Calculate counts from status output rows */
export const calculateCounts = (status: StatusOutputRow[]): SourceTrackingCounts => {
  const { localChanges, remoteChanges, conflicts } = separateChangesByOriginAndConflict(status);
  return { local: localChanges.length, remote: remoteChanges.length, conflicts: conflicts.length };
};

/** Separate changes by type for hover details, then sorts by type and name */
export const separateChanges = (status: StatusOutputRow[]): SourceTrackingDetails => {
  const { localChanges, remoteChanges, conflicts } = separateChangesByOriginAndConflict(status);
  return {
    localChanges: localChanges.toSorted(statusRowOrder),
    remoteChanges: remoteChanges.toSorted(statusRowOrder),
    conflicts: conflicts.toSorted(statusRowOrder)
  };
};

/** Get command based on counts.  If there are only local or remote changes, it'll do that.  If there are both, it'll open the changes */
export const getCommand = (counts: SourceTrackingCounts): string | undefined => {
  if (counts.remote > 0 && counts.local === 0 && counts.conflicts === 0) {
    return 'sf.project.retrieve.start';
  } else if (counts.local > 0 && counts.remote === 0 && counts.conflicts === 0) {
    return 'sf.project.deploy.start';
  } else if ((counts.remote > 0 && counts.local > 0) || counts.conflicts > 0) {
    return 'sf.view.all.changes';
  }
  return undefined;
};
