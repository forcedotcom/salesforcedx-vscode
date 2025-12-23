/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
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

/** Deduplicate status rows by fullName and type */
export const dedupeStatus = (status: StatusOutputRow[]): StatusOutputRow[] => {
  const seen = new Set<string>();
  // priority is conflicts, always preserve those
  const conflicts = status.filter(row => row.conflict);
  const notConflicts = status.filter(row => !row.conflict);
  return [...conflicts, ...notConflicts].filter(row => {
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

/** Calculate counts from status output rows */
export const calculateCounts = (status: StatusOutputRow[]): SourceTrackingCounts => {
  const local = status.filter(row => row.origin === 'local' && !row.conflict && !row.ignored).length;
  const remote = status.filter(row => row.origin === 'remote' && !row.conflict && !row.ignored).length;
  const conflicts = status.filter(row => row.conflict && !row.ignored).length;

  return { local, remote, conflicts };
};

/** Separate changes by type for hover details */
export const separateChanges = (status: StatusOutputRow[]): SourceTrackingDetails => {
  const localChanges = status.filter(row => row.origin === 'local' && !row.conflict && !row.ignored);
  const remoteChanges = status.filter(row => row.origin === 'remote' && !row.conflict && !row.ignored);
  const conflicts = status.filter(row => row.conflict && !row.ignored);

  return { localChanges, remoteChanges, conflicts };
};

/** Get command based on counts */
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
