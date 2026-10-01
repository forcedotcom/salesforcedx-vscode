/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Main VS Code workbench container */
export const WORKBENCH = '.monaco-workbench';

/** Monaco text editor */
export const EDITOR = '.monaco-editor';

/** Monaco editor with a file URI data attribute */
export const EDITOR_WITH_URI = `${EDITOR}[data-uri]`;

/** Editor with unsaved changes */
export const DIRTY_EDITOR = `${EDITOR}.dirty`;

/** Editor showing an org metadata catalog document (sf-org-metadata: scheme) */
export const ORG_METADATA_EDITOR = `${EDITOR_WITH_URI}[data-uri^="sf-org-metadata:"]`;

/** Quick Open/Quick Pick widget (Ctrl+P, F1, etc) */
export const QUICK_INPUT_WIDGET = '.quick-input-widget';

/** Individual list items in Quick Open/Quick Pick */
export const QUICK_INPUT_LIST_ROW = '.quick-input-list .monaco-list-row';

/** File tab in the editor tab bar */
export const TAB = `${WORKBENCH} .tabs-container .tab`;

/** Close button icon on tabs */
export const TAB_CLOSE_BUTTON = '.codicon-close';

/** Status bar item label (web) */
export const STATUS_BAR_ITEM_LABEL = '.statusbar-item-label';

/** Apex Log trace flag status bar (salesforcedx-vscode-apex-log) */
export const APEX_TRACE_FLAG_STATUS_BAR = '#salesforce\\.salesforcedx-vscode-apex-log\\.apex-trace-flag-status';

/** Notification list items in the notification center */
export const NOTIFICATION_LIST_ITEM = `${WORKBENCH} .notification-list-item`;

/** Settings editor search input (data-uri is stable across VS Code versions; Monaco may not expose a light-DOM textarea) */
export const SETTINGS_SEARCH_INPUT = [
  `${WORKBENCH} [data-uri^="settingseditor:searchinput"]`,
  `${WORKBENCH} .settings-header .search-container ${EDITOR}`,
  `${WORKBENCH} [aria-label="Settings"] .settings-header .search-container ${EDITOR}`
] as const;

/** VS Code context menu container */
export const CONTEXT_MENU = '.monaco-menu';

/** Inline filename input rendered in the Explorer tree by "New File..."/"New Folder..." */
export const EXPLORER_INLINE_INPUT = '.explorer-folders-view input.input';

/**
 * Code lens interactive element — desktop (Electron) renders as `<a>` inside
 * `.codelens-decoration`; web (Chromium) renders as `<button>` directly.
 */
export const CODELENS_ITEM = '.codelens-decoration a, .codelens-decoration button';
