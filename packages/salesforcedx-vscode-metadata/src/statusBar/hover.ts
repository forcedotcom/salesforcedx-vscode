/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as vscode from 'vscode';
import { nls } from '../messages';

type SourceTrackingCounts = {
  local: number;
  remote: number;
  conflicts: number;
};

type SourceTrackingDetails = {
  localChanges: StatusOutputRow[];
  remoteChanges: StatusOutputRow[];
  conflicts: StatusOutputRow[];
};

/** Build combined hover text with up to 3 sections (only showing non-zero counts) */
export const buildCombinedHoverText = (
  details: SourceTrackingDetails,
  counts: SourceTrackingCounts
): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  const sections: string[] = [];

  // Conflicts section - only if > 0
  if (counts.conflicts > 0) {
    const label = nls.localize('source_tracking_status_bar_conflicts');
    const items = details.conflicts.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
    const moreText = details.conflicts.length > 10 ? `\n- _(${String(details.conflicts.length - 10)} more...)_` : '';
    sections.push(`**${label} (${String(counts.conflicts)}):**\n\n${items.join('\n')}${moreText}`);
  }

  // Remote Changes section - only if > 0
  if (counts.remote > 0) {
    const label = nls.localize('source_tracking_status_bar_remote_changes');
    const items = details.remoteChanges.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
    const moreText =
      details.remoteChanges.length > 10 ? `\n- _(${String(details.remoteChanges.length - 10)} more...)_` : '';
    sections.push(`**${label} (${String(counts.remote)}):**\n\n${items.join('\n')}${moreText}`);
  }

  // Local Changes section - only if > 0
  if (counts.local > 0) {
    const label = nls.localize('source_tracking_status_bar_local_changes');
    const items = details.localChanges.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
    const moreText =
      details.localChanges.length > 10 ? `\n- _(${String(details.localChanges.length - 10)} more...)_` : '';
    sections.push(`**${label} (${String(counts.local)}):**\n\n${items.join('\n')}${moreText}`);
  }

  md.appendMarkdown(sections.join('\n\n---\n\n'));

  // Add click hint based on state
  const hasRemoteOnly = counts.remote > 0 && counts.local === 0 && counts.conflicts === 0;
  const hasLocalOnly = counts.local > 0 && counts.remote === 0 && counts.conflicts === 0;
  const hasBothOrConflicts = (counts.remote > 0 && counts.local > 0) || counts.conflicts > 0;

  if (hasRemoteOnly) {
    const clickMsg = nls.localize('source_tracking_status_bar_click_to_retrieve');
    md.appendMarkdown(`\n\n---\n\n${clickMsg}`);
  } else if (hasLocalOnly) {
    const clickMsg = nls.localize('source_tracking_status_bar_click_to_push');
    md.appendMarkdown(`\n\n---\n\n${clickMsg}`);
  } else if (hasBothOrConflicts) {
    const clickMsg = nls.localize('source_tracking_status_bar_click_to_view_details');
    md.appendMarkdown(`\n\n---\n\n${clickMsg}`);
  }

  return md;
};
