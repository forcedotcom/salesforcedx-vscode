/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { STATUS_BAR_ITEM_LABEL, WORKBENCH } from '@salesforce/playwright-vscode-ext';

/** Text shown in the Aura language status item when the LSP has finished indexing. */
const AURA_LSP_READY_TEXT = 'Indexing complete';

/**
 * Waits for the Aura Language Server to finish indexing.
 * `auraLspStatusBarItem.ts` registers the status via `createLanguageStatusItem('auraLanguageServerStatus')`,
 * whose ready text is `Indexing complete $(check)` (i18n `aura_language_server_loaded`). VS Code surfaces
 * `createLanguageStatusItem` as the **Editor Language Status** control (status bar button), not
 * `.statusbar-item-label`. Keep a fallback on the legacy label selector for older layouts (mirrors
 * `lwcUtils.waitForLwcLspReady`).
 */
export const waitForAuraLspReady = async (page: Page, timeout = 120_000): Promise<void> => {
  const editorLanguageStatus = page.locator(WORKBENCH).getByRole('button', { name: new RegExp(AURA_LSP_READY_TEXT) });
  const legacyStatusBarLabel = page.locator(STATUS_BAR_ITEM_LABEL).filter({ hasText: AURA_LSP_READY_TEXT });
  await expect(
    editorLanguageStatus.or(legacyStatusBarLabel).first(),
    `Aura LSP should show "${AURA_LSP_READY_TEXT}" when indexing is done`
  ).toBeVisible({ timeout });
};
