/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { openFileFromExplorerTree } from '@salesforce/playwright-vscode-ext';

/**
 * UI-only Apex LSP readiness: wait for the "Indexing complete" language-status button. The desktop
 * twin also checks StandardApexLibrary on disk, but the container's workspace is inside the image
 * (and boots pre-indexed), so the button alone is the reliable in-browser signal. `toBeVisible`
 * auto-retries until the button's accessible name settles to "Indexing complete", so a late/flickering
 * status flip is tolerated within the generous bound.
 */
export const waitForApexLspReady = async (page: Page): Promise<void> => {
  await expect(page.getByRole('button', { name: /Indexing complete/ })).toBeVisible({ timeout: 120_000 });
};

/**
 * Open an Apex source file from the Explorer tree, retrying the entire focus + expand + open pass.
 *
 * In the Code Builder container the Explorer tree hydrates progressively (browser round-trip to the
 * server-side file-system provider), so a compact parent folder such as `classes` may not yet be
 * rendered when `openFileFromExplorerTree` runs its one-shot expansion pass. That helper silently
 * skips expanding folders it can't see, so the leaf file never renders and its `treeitem` locator
 * times out (the observed `locator.waitFor: Timeout 15000ms` at the file-open step). Wrapping the
 * whole open in `toPass` re-runs the expansion pass once the tree has hydrated, which reliably
 * surfaces and opens the file.
 */
export const openApexFileFromExplorerTree = async (
  page: Page,
  fileName: string,
  parentFolders: readonly string[]
): Promise<void> => {
  await expect(async () => {
    await openFileFromExplorerTree(page, fileName, parentFolders);
  }).toPass({ timeout: 120_000, intervals: [1000, 2000, 5000] });
};
