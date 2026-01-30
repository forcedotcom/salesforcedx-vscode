/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SourceTrackingCounts, SourceTrackingDetails } from './helpers';
import * as Match from 'effect/Match';
import * as vscode from 'vscode';
import { nls } from '../messages';

/** Build combined hover text with up to 3 sections (only showing non-zero counts) */
export const buildCombinedHoverText = (
  details: SourceTrackingDetails,
  counts: SourceTrackingCounts
): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  // Conflicts section - only if > 0
  if (counts.conflicts > 0) {
    const items = details.conflicts.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
    const moreText = details.conflicts.length > 10 ? `\n- _(${String(details.conflicts.length - 10)} more...)_` : '';
    md.appendMarkdown(
      `**${nls.localize('source_tracking_status_bar_conflicts')} (${String(counts.conflicts)}):**\n\n${items.join('\n')}${moreText}`
    );
    md.appendMarkdown('\n\n---\n\n');
  }

  // Remote Changes section - only if > 0
  if (counts.remote > 0) {
    const items = details.remoteChanges.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
    const moreText =
      details.remoteChanges.length > 10 ? `\n- _(${String(details.remoteChanges.length - 10)} more...)_` : '';
    md.appendMarkdown(
      `**${nls.localize('source_tracking_status_bar_remote_changes')} (${String(counts.remote)}):**\n\n${items.join('\n')}${moreText}`
    );
    md.appendMarkdown('\n\n---\n\n');
  }

  // Local Changes section - only if > 0
  if (counts.local > 0) {
    const items = details.localChanges.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
    const moreText =
      details.localChanges.length > 10 ? `\n- _(${String(details.localChanges.length - 10)} more...)_` : '';
    md.appendMarkdown(
      `**${nls.localize('source_tracking_status_bar_local_changes')} (${String(counts.local)}):**\n\n${items.join('\n')}${moreText}`
    );
    md.appendMarkdown('\n\n---\n\n');
  }

  md.appendMarkdown(getClickHint(counts));

  return md;
};

/** Get click hint based on counts */
const getClickHint = (counts: SourceTrackingCounts): string =>
  Match.value(counts).pipe(
    Match.when({ remote: (n: number) => n > 0, local: 0, conflicts: 0 }, () =>
      nls.localize('source_tracking_status_bar_click_to_retrieve')
    ),
    Match.when({ local: (n: number) => n > 0, remote: 0, conflicts: 0 }, () =>
      nls.localize('source_tracking_status_bar_click_to_push')
    ),
    Match.when({ remote: (n: number) => n > 0, local: (n: number) => n > 0 }, () =>
      nls.localize('source_tracking_status_bar_click_to_view_details')
    ),
    Match.orElse(() => nls.localize('source_tracking_status_bar_no_changes'))
  );
