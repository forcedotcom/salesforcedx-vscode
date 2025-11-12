/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as vscode from 'vscode';
import { nls } from '../messages';

export const buildLocalHoverText = (changes: StatusOutputRow[]): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  const label = nls.localize('source_tracking_status_bar_local_changes');
  md.appendMarkdown(`**${label} (${String(changes.length)}):**\n\n`);

  const list = changes.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
  md.appendMarkdown(list.join('\n'));

  if (changes.length > 10) {
    md.appendMarkdown(`\n- _(${String(changes.length - 10)} more...)_`);
  }

  const clickMsg = nls.localize('source_tracking_status_bar_click_to_push');
  md.appendMarkdown(`\n\n---\n\n${clickMsg}`);

  return md;
};

/** Build hover text for remote changes */
export const buildRemoteHoverText = (changes: StatusOutputRow[]): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  const label = nls.localize('source_tracking_status_bar_remote_changes');
  md.appendMarkdown(`**${label} (${String(changes.length)}):**\n\n`);

  const list = changes.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
  md.appendMarkdown(list.join('\n'));

  if (changes.length > 10) {
    md.appendMarkdown(`\n- _(${String(changes.length - 10)} more...)_`);
  }

  return md;
};

/** Build hover text for conflicts */
export const buildConflictsHoverText = (conflicts: StatusOutputRow[]): vscode.MarkdownString => {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  const label = nls.localize('source_tracking_status_bar_conflicts');
  md.appendMarkdown(`**${label} (${String(conflicts.length)}):**\n\n`);

  const list = conflicts.slice(0, 10).map(row => `- ${String(row.type)}: ${String(row.fullName)}`);
  md.appendMarkdown(list.join('\n'));

  if (conflicts.length > 10) {
    md.appendMarkdown(`\n- _(${String(conflicts.length - 10)} more...)_`);
  }

  return md;
};
