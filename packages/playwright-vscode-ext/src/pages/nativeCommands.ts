/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Page } from '@playwright/test';
import { executeCommandWithCommandPalette, OpenCommandPaletteOptions } from './commands';

/**
 * Named wrappers for VS Code built-in (native) command-palette commands.
 *
 * Each delegates to `executeCommandWithCommandPalette` with the native command title, so callers
 * get discoverable, refactor-safe functions instead of bare string literals. Extension-owned
 * commands (`SFDX: …`, `Testing: …`, `Test: …`) are intentionally NOT wrapped here — they keep
 * calling `executeCommandWithCommandPalette` directly.
 */

/** `File: Focus on Files Explorer` */
export const focusOnFilesExplorer = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer', undefined, options);

/** `File: New Untitled Text File` */
export const newUntitledTextFile = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'File: New Untitled Text File', undefined, options);

/** `File: Save` */
export const saveFile = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'File: Save', undefined, options);

/** `Notifications: Clear All Notifications` */
export const clearAllNotifications = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Notifications: Clear All Notifications', undefined, options);

/** `View: Close All Editors` */
export const closeAllEditors = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'View: Close All Editors', undefined, options);

/** `View: Show Explorer` */
export const showExplorer = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'View: Show Explorer', undefined, options);

/** `Developer: Reload Window` */
export const reloadWindow = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Developer: Reload Window', undefined, options);

/** `Go to File...` */
export const goToFile = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Go to File...', undefined, options);

/** `Go to Line/Column...` */
export const goToLineColumn = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Go to Line/Column...', undefined, options);

/** `Select All` */
export const selectAll = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Select All', undefined, options);

/** `Paste` */
export const paste = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Paste', undefined, options);

/** `Problems: Focus on Problems View` */
export const focusOnProblemsView = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Problems: Focus on Problems View', undefined, options);

/** `Go to Definition` */
export const goToDefinition = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Go to Definition', undefined, options);

/** `View: Focus Active Editor Group` */
export const focusActiveEditorGroup = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'View: Focus Active Editor Group', undefined, options);

/** `Find` */
export const find = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Find', undefined, options);

/** `View: Hide Panel` */
export const hidePanel = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'View: Hide Panel', undefined, options);

/** `View: Clear Output` */
export const clearOutput = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'View: Clear Output', undefined, options);

/** `View: Close Editor` */
export const closeEditor = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'View: Close Editor', undefined, options);

/** `Snippets: Insert Snippet` */
export const insertSnippet = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Snippets: Insert Snippet', undefined, options);

/** `Developer: Show Running Extensions` */
export const showRunningExtensions = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Developer: Show Running Extensions', undefined, options);

/** `View: Hide Secondary Side Bar` */
export const hideSecondarySideBar = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'View: Hide Secondary Side Bar', undefined, options);

/** `Workspaces: Close Workspace` */
export const closeWorkspace = (page: Page, options?: OpenCommandPaletteOptions): Promise<void> =>
  executeCommandWithCommandPalette(page, 'Workspaces: Close Workspace', undefined, options);
