/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Main VS Code workbench container */
export const WORKBENCH = '.monaco-workbench';

/** Monaco text editor */
export const EDITOR = '.monaco-editor';

/** Monaco editor with a file URI data attribute */
export const EDITOR_WITH_URI = '.monaco-editor[data-uri]';

/** Editor with unsaved changes */
export const DIRTY_EDITOR = '.monaco-editor.dirty';

/** Quick Open/Quick Pick widget (Ctrl+P, F1, etc) */
export const QUICK_INPUT_WIDGET = '.quick-input-widget';

/** Individual list items in Quick Open/Quick Pick */
export const QUICK_INPUT_LIST_ROW = '.quick-input-list .monaco-list-row';

/** File tab in the editor tab bar */
export const TAB = '.tab';

/** Close button icon on tabs */
export const TAB_CLOSE_BUTTON = '.codicon-close';

/** Status bar item label (web) */
export const STATUS_BAR_ITEM_LABEL = '.statusbar-item-label';

/** Notification list items in the notification center */
export const NOTIFICATION_LIST_ITEM = '.monaco-workbench .notification-list-item';

/** Settings editor search input */
export const SETTINGS_SEARCH_INPUT = [
  '#workbench\\.parts\\.editor .settings-header .search-container .monaco-editor',
  '[aria-label="Settings"] .settings-header .search-container .monaco-editor'
] as const;
