/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { createMinimalOrg } from '../orgs/minimalScratchOrgSetup';
import { executeCommandWithCommandPalette, verifyCommandExists } from '../pages/commands';
import {
  clearOutputChannel,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText
} from '../pages/outputChannel';
import { upsertScratchOrgAuthFieldsToSettings } from '../pages/settings';
import { saveScreenshot } from '../shared/screenshotUtils';
import {
  assertWelcomeTabExists,
  closeSettingsTab,
  closeWelcomeTabs,
  disableMonacoAutoClosing,
  ensureSecondarySideBarHidden,
  isDesktop,
  waitForVSCodeWorkbench,
  waitForQuickInputFirstOption
} from './helpers';
import { DIRTY_EDITOR, EDITOR_WITH_URI, NOTIFICATION_LIST_ITEM, QUICK_INPUT_LIST_ROW, WORKBENCH } from './locators';
import { activeQuickInputWidget } from './quickInput';

/** Default timeout for deploy to complete (10 minutes, matches metadata deploy tests). */
const DEFAULT_DEPLOY_COMPLETE_TIMEOUT_MS = 600_000;

/**
 * Creates a new untitled file with contents.
 * NOTE: This creates an UNTITLED file that is NOT saved to disk.
 * For tests that need actual files on disk, use createApexClass or similar extension commands.
 * The filePath parameter is currently unused - file remains as Untitled-N.
 */
export const createFileWithContents = async (page: Page, _filePath: string, contents: string): Promise<void> => {
  await page.locator(WORKBENCH).click();

  // Create a new untitled file
  await executeCommandWithCommandPalette(page, 'File: New Untitled Text File');

  // Wait for command palette to close first
  const widget = activeQuickInputWidget(page);
  await widget.waitFor({ state: 'hidden', timeout: 5000 });

  // Wait for the editor to open - wait for attachment first, then visibility
  // Use expect().toBeAttached() for better error messages and retry logic
  const editor = page.locator(EDITOR_WITH_URI).first();
  await expect(editor).toBeAttached({ timeout: 15_000 });
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();

  // Type the file contents
  await page.keyboard.type(contents);

  // Note: We don't save the file to avoid filesystem/native dialog issues in web
  // The file remains as an untitled file which works identically in web and desktop
};

/** Creates a new Apex class using the SFDX: Create Apex Class command */
export const createApexClass = async (page: Page, className: string, content?: string): Promise<void> => {
  // Close Settings tab to avoid focus issues
  await closeSettingsTab(page);
  await closeWelcomeTabs(page);

  // Wait for the extension to load and register the command
  await verifyCommandExists(page, 'SFDX: Create Apex Class', 30_000);

  await executeCommandWithCommandPalette(page, 'SFDX: Create Apex Class');

  // First prompt: Quick Pick to select template - press Enter to accept default (DefaultApexClass)
  await waitForQuickInputFirstOption(page);
  await page.keyboard.press('Enter');

  // Second prompt: "Enter Apex class name"
  const quickInput = activeQuickInputWidget(page);
  await quickInput.getByText(/Enter Apex class name/i).waitFor({ state: 'visible', timeout: 30_000 });
  await page.keyboard.type(className);
  await page.keyboard.press('Enter');

  // Third prompt: Quick Pick to select output directory - just press Enter to accept default
  await waitForQuickInputFirstOption(page);
  await page.keyboard.press('Enter');

  // Wait for the editor to open with the new class (extension writes a template and opens it)
  // Target by filename: .first() can select the wrong tab when multiple editors are open (e.g. create
  // ExampleApexClass then ExampleApexClassTest — leftmost tab stays first, so we'd paste into wrong file)
  const fileName = `${className}.cls`;
  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${fileName}"]`);
  await editor.waitFor({ state: 'visible', timeout: 15_000 });

  // If content is provided, replace the template with it and save (so the file is on disk and deployable)
  if (content !== undefined && content.length > 0) {
    // Close secondary sidebar (Chat/Agent) so keystrokes go to the editor, not the chat input
    await ensureSecondarySideBarHidden(page);

    // Focus the editor - click and verify it's ready for input by checking view lines are present
    await editor.click();
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });

    // Select all (template) via command palette so it runs in the active editor (keyboard shortcut can miss on web)
    await executeCommandWithCommandPalette(page, 'Select All');

    // Delete the selected content
    await page.keyboard.press('Delete');

    // Write to clipboard (evaluate completes when write is done)
    // Note: Clipboard permissions are granted globally in playwright config (createWebConfig.ts & createDesktopConfig.ts)
    await page.evaluate((text: string) => navigator.clipboard.writeText(text), content);

    // Paste the content
    await executeCommandWithCommandPalette(page, 'Paste');

    // Save so the file is persisted and can be deployed / discovered by the test controller
    await executeCommandWithCommandPalette(page, 'File: Save');
    await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 10_000 });
  }
};

/**
 * Deploys the currently active editor (or selected source) to the org via "SFDX: Deploy This Source to Org".
 * Waits for the deploy progress notification to appear. Completion: if waitViaOutputChannel is true (e.g. Apex
 * testing), waits for "Deployed Source" in the Salesforce Metadata output channel; otherwise waits for the notification
 * to disappear.
 */
export const deployCurrentSourceToOrg = async (
  page: Page,
  options?: { deployCompleteTimeoutMs?: number; waitViaOutputChannel?: boolean }
): Promise<void> => {
  const deployCompleteTimeoutMs = options?.deployCompleteTimeoutMs ?? DEFAULT_DEPLOY_COMPLETE_TIMEOUT_MS;
  const waitViaOutputChannel = options?.waitViaOutputChannel ?? false;

  await verifyCommandExists(page, 'SFDX: Deploy This Source to Org', 30_000);
  await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');

  const deployingNotification = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /Deploying/i })
    .first();
  await expect(deployingNotification, 'Deploy progress notification should appear').toBeVisible({ timeout: 30_000 });

  if (waitViaOutputChannel) {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', deployCompleteTimeoutMs);
    await waitForOutputChannelText(page, {
      expectedText: 'Deployed Source',
      timeout: deployCompleteTimeoutMs
    });
  } else {
    await expect(deployingNotification).not.toBeVisible({
      timeout: deployCompleteTimeoutMs
    });
  }
};

/**
 * Open a file by clicking its entry in the Files Explorer tree. Works on both web and desktop.
 *
 * Use this when {@link openFileByName} (Quick Open) won't work — notably on VS Code Web where
 * the `vscode-test-web` file system provider doesn't implement `provideFileSearch`, so Quick
 * Open returns "No matching results" for files that haven't been opened yet.
 *
 * Intermediate folders are auto-expanded when needed. Compact folders (VS Code's default) are
 * handled transparently because the file's treeitem is reachable as soon as any ancestor row
 * is expanded. If the user has disabled compact folders, pass `parentFolders` so we can expand
 * each segment individually.
 *
 * @param page Playwright page
 * @param fileName File name to open (must be unique within the Explorer — pass `parentFolders` to disambiguate when needed).
 * @param parentFolders Optional parent-folder names in order to expand before locating the file. Safe to pass even when compact folders are enabled; expansion is a no-op if already open or if the folder row isn't present (compact-folder merge).
 */
export const openFileFromExplorerTree = async (
  page: Page,
  fileName: string,
  parentFolders: readonly string[] = []
): Promise<void> => {
  // Focus the Files Explorer view; palette avoids keybinding conflicts
  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  const tree = page.getByRole('tree', { name: /Files Explorer/i }).first();
  await tree.waitFor({ state: 'visible', timeout: 10_000 });

  // Expand each parent folder if it's actually present as its own row. Compact folders merge
  // multiple levels into one row, so some segments may not exist as separate treeitems — that's
  // fine: the leaf file will still be reachable once any ancestor compact row is expanded.
  for (const folderName of parentFolders) {
    const folderItem = tree.getByRole('treeitem', { name: new RegExp(`^${escapeRegExp(folderName)}\\b`) }).first();
    if (!(await folderItem.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const expanded = (await folderItem.getAttribute('aria-expanded').catch(() => null)) === 'true';
    if (expanded) continue;
    await folderItem.scrollIntoViewIfNeeded().catch(() => {});
    // Double-click reliably expands in VS Code's Explorer; single click only selects.
    await folderItem.dblclick({ timeout: 5000 }).catch(() => {});
    await expect(folderItem).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 }).catch(() => {});
  }

  const fileItem = tree.getByRole('treeitem', { name: new RegExp(`^${escapeRegExp(fileName)}$`) }).first();
  await fileItem.waitFor({ state: 'visible', timeout: 15_000 });
  await fileItem.scrollIntoViewIfNeeded().catch(() => {});
  // Double-click to ensure the file opens as a non-preview tab and gains focus; single click
  // sometimes opens in preview mode that subsequent Explorer clicks replace.
  await fileItem.dblclick({ timeout: 5000 });

  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.waitFor({ state: 'visible', timeout: 15_000 });
};

const escapeRegExp = (s: string): string => s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Open a file using Quick Open.
 * Big caveat: on the web, this'll only work with files that have already been opened, in the editor (not just call didOpen on it!)
 * that's a limitation of web fs on vscode because search/find files doesn't work yet.
 */
export const openFileByName = async (page: Page, fileName: string): Promise<void> => {
  const widget = activeQuickInputWidget(page);

  if (isDesktop()) {
    // On macOS desktop, Control+P doesn't work reliably, use command palette instead
    await executeCommandWithCommandPalette(page, 'Go to File...');

    // Wait for Quick Open widget to be visible and ready
    await expect(widget).toBeVisible({ timeout: 10_000 });
    const input = widget.locator('input.input');
    await input.waitFor({ state: 'attached', timeout: 5000 });
    await input.click({ force: true, timeout: 5000 });

    // Clear any existing text and ensure input is focused
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
  } else {
    // On web Control+P works fine as long as file has been opened in the editor first
    await page.locator(WORKBENCH).click();
    await page.keyboard.press('Control+p');
    await widget.waitFor({ state: 'visible', timeout: 10_000 });
    const input = widget.locator('input.input');
    await input.waitFor({ state: 'attached', timeout: 5000 });
    await input.click({ force: true, timeout: 5000 });
  }

  // Type the filename
  await page.keyboard.type(fileName);

  // Wait for search results to populate and stabilize
  await waitForQuickInputFirstOption(page);
  // Wait for results to be stable (no new results appearing)
  await activeQuickInputWidget(page).waitFor({ state: 'visible', timeout: 1000 });

  // Find the result that matches the filename
  const results = page.locator(QUICK_INPUT_LIST_ROW);
  const resultCount = await results.count();
  let foundMatch = false;
  let matchIndex = 0;
  for (let i = 0; i < resultCount; i++) {
    const resultText = await results.nth(i).textContent();
    // Check if the result contains the filename (Quick Open results include path info)
    // Match if filename appears as a complete word (not part of another filename)
    if (
      resultText &&
      (resultText.includes(`/${fileName}`) || resultText.includes(`\\${fileName}`) || resultText.startsWith(fileName))
    ) {
      matchIndex = i;
      foundMatch = true;
      break;
    }
  }

  if (!foundMatch) {
    // Log all available results for debugging
    const allResults: string[] = [];
    for (let i = 0; i < Math.min(resultCount, 10); i++) {
      const text = await results.nth(i).textContent();
      if (text) allResults.push(text.trim());
    }
    // Check if Quick Open might be showing command palette results instead of files
    const firstResult = allResults[0] || '';
    if (firstResult.toLowerCase().includes('similar commands') || firstResult.toLowerCase().includes('no matching')) {
      throw new Error(
        `Quick Open appears to be showing command palette results instead of files. Found ${resultCount} results. First few: ${allResults.join(' | ')}`
      );
    }
    throw new Error(
      `No exact match found for "${fileName}" in Quick Open. Found ${resultCount} results. First few: ${allResults.join(' | ')}`
    );
  }

  // Navigate to the matching result using arrow keys
  for (let i = 0; i < matchIndex; i++) {
    await page.keyboard.press('ArrowDown');
  }

  // Press Enter to open the selected result
  await page.keyboard.press('Enter');

  // Wait for editor to open with the file
  await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 10_000 });
};

/** Edit the currently open file by adding a comment at the top */
export const editAndSaveOpenFile = async (page: Page, comment: string): Promise<void> => {
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.waitFor({ state: 'visible' });

  // Wait for editor content to render (at least one line visible)
  await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });

  // Click the editor container first to ensure it's focused
  // This is needed on all platforms to activate the editor
  await editor.click();

  // Go to end of first line (class declaration)
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('End');

  // Insert new line below and type comment
  await page.keyboard.press('Enter');
  await page.keyboard.type(`// ${comment}`);

  // Save file
  await executeCommandWithCommandPalette(page, 'File: Save');
  await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 5000 });
};

/**
 * Setup minimal org + auth with workbench loading in parallel.
 * Runs createMinimalOrg() and waitForVSCodeWorkbench(page) together so the
 * browser shows VS Code while the org is created (avoids "tests do nothing" on web).
 * @param checkWelcomeTabs When true (default), assert Welcome/Walkthrough tab exists and close welcome tabs. Set to false to skip.
 */
export const setupMinimalOrgAndAuth = async (page: Page, checkWelcomeTabs = true): Promise<void> => {
  const [createResult] = await Promise.all([createMinimalOrg(), waitForVSCodeWorkbench(page)]);
  if (checkWelcomeTabs) {
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
  }
  await saveScreenshot(page, 'setup.after-workbench.png');
  await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  await saveScreenshot(page, 'setup.after-auth-fields.png');
};

/** Create an Apex test class and deploy it to the org. */
export const createAndDeployApexTestClass = async (page: Page, className: string, content: string): Promise<void> => {
  // Disable auto-closing brackets temporarily to avoid duplicates when typing
  await disableMonacoAutoClosing(page);
  await createApexClass(page, className, content);

  // On web, saving the file auto-deploys via push-or-deploy-on-save, so we just wait for completion
  // On desktop, we need to explicitly deploy
  if (isDesktop()) {
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
  }
  // Web: wait for auto-deploy to complete by checking output channel.
  // Use className (unique per deploy) instead of "2 components deployed" so we don't match the previous deploy's output.
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Salesforce Metadata', DEFAULT_DEPLOY_COMPLETE_TIMEOUT_MS);
  await waitForOutputChannelText(page, {
    expectedText: className,
    timeout: DEFAULT_DEPLOY_COMPLETE_TIMEOUT_MS
  });

  await saveScreenshot(page, 'setup.apex-test-class-created.png');
  await clearOutputChannel(page);
};
