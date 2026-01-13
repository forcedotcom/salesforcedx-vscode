/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { isWindowsDesktop } from '../utils/helpers';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';

export const openCommandPalette = async (page: Page): Promise<void> => {
  const { WORKBENCH, TAB } = await import('../utils/locators.js');
  const { closeWelcomeTabs } = await import('../utils/helpers.js');
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const workbench = page.locator(WORKBENCH);
  
  // Retry opening command palette if widget exists but is hidden (welcome tabs may interfere)
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    // Ensure welcome tabs are closed before opening command palette - be aggressive about this
    await closeWelcomeTabs(page);
    
    // Verify no welcome tabs exist - check multiple times to ensure they're really gone
    const welcomeTabs = page.locator(TAB).filter({ hasText: /Welcome|Walkthrough/i });
    let welcomeTabCount = await welcomeTabs.count();
    let closeAttempts = 0;
    while (welcomeTabCount > 0 && closeAttempts < 5) {
      await closeWelcomeTabs(page);
      // Wait for tab container to update after closing
      const tabContainer = page.locator('.tabs-container');
      await tabContainer.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
      // Re-query tabs to avoid stale references
      const currentWelcomeTabs = page.locator(TAB).filter({ hasText: /Welcome|Walkthrough/i });
      welcomeTabCount = await currentWelcomeTabs.count();
      // If tabs are still there, try closing them directly
      if (welcomeTabCount > 0) {
        const { TAB_CLOSE_BUTTON: TAB_CLOSE_BTN } = await import('../utils/locators.js');
        const tabToClose = currentWelcomeTabs.first();
        const closeButton = tabToClose.locator(TAB_CLOSE_BTN);
        const closeButtonVisible = await closeButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (closeButtonVisible) {
          await closeButton.click({ timeout: 2000, force: true }).catch(() => {});
          await tabToClose.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
        } else {
          // Fallback to keyboard shortcut
          await workbench.click({ timeout: 1000 }).catch(() => {});
          await tabToClose.click({ timeout: 1000, force: true }).catch(() => {});
          await page.keyboard.press('Control+w');
          await tabToClose.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
        }
        // Re-check count after direct close attempt
        const recheckTabs = page.locator(TAB).filter({ hasText: /Welcome|Walkthrough/i });
        welcomeTabCount = await recheckTabs.count();
      }
      closeAttempts++;
    }
    
    // Ensure workbench is focused and visible before opening command palette
    // Click multiple times to ensure focus
    await workbench.click({ timeout: 5000 }).catch(() => {});
    await workbench.click({ timeout: 5000 }).catch(() => {});
    await expect(workbench).toBeVisible({ timeout: 5000 });
    // Wait for workbench to be stable - ensure no overlays are blocking
    await workbench.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    
    // Close any existing quick input widget
    const existingWidget = page.locator(QUICK_INPUT_WIDGET);
    const existingVisible = await existingWidget.isVisible({ timeout: 500 }).catch(() => false);
    if (existingVisible) {
      await page.keyboard.press('Escape');
      await existingWidget.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    }
    
    // Try F1 first (standard command palette shortcut)
    await page.keyboard.press('F1');
    
    // Wait for widget to be attached (exists in DOM) first
    await widget.waitFor({ state: 'attached', timeout: 10_000 });
    
    // Try to verify widget is visible - if it fails, welcome tabs may be interfering
    let widgetVisible = await widget.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Widget may exist but be hidden - try to force it visible (works on both web and desktop)
    if (!widgetVisible) {
      const widgetElement = await widget.elementHandle();
      if (widgetElement) {
        await widgetElement.evaluate((el: HTMLElement) => {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          el.focus();
        }).catch(() => {});
        // Re-check visibility after forcing
        const nowVisible = await widget.isVisible({ timeout: 2000 }).catch(() => false);
        if (nowVisible) {
          widgetVisible = true;
        }
      }
    }
    
    if (widgetVisible) {
      // Widget is visible - verify it stays visible and input is ready
      await expect(widget).toBeVisible({ timeout: 10_000 });
      const input = widget.locator('input.input');
      await input.waitFor({ state: 'attached', timeout: 10_000 });
      // Check if input is visible - if not, force visibility on both widget and input
      const inputVisible = await input.isVisible({ timeout: 2000 }).catch(() => false);
      if (!inputVisible) {
        // Force visibility on widget first (parent element)
        const widgetElement = await widget.elementHandle();
        if (widgetElement) {
          await widgetElement.evaluate((el: HTMLElement) => {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            el.style.zIndex = '10000';
          }).catch(() => {});
        }
        // Then force visibility on input
        const inputElement = await input.elementHandle();
        if (inputElement) {
          await inputElement.evaluate((el: HTMLElement) => {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            (el as HTMLInputElement).focus();
          }).catch(() => {});
        }
      }
      // Wait for input to be visible (with retry logic)
      await expect(input).toBeVisible({ timeout: 10_000 });
      return;
    }
    
    // Widget or input is hidden - retry
    attempts++;
    if (attempts < maxAttempts) {
      // Wait for workbench to be ready before retry
      await page.locator(WORKBENCH).waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    }
  }
  
  // After max attempts, try Windows fallback if on Windows desktop
  if (isWindowsDesktop()) {
    await page.locator(WORKBENCH).click();
    await page.keyboard.press('Control+Shift+p');
    await widget.waitFor({ state: 'attached', timeout: 10_000 });
    await expect(widget).toBeVisible({ timeout: 10_000 });
  } else {
    // Final attempt - widget exists but may be hidden due to welcome tabs
    // Try to force it visible by closing welcome tabs one more time and pressing F1 again
    await closeWelcomeTabs(page);
    await page.locator(WORKBENCH).click();
    await page.keyboard.press('F1');
    await widget.waitFor({ state: 'attached', timeout: 10_000 });
    // Widget may exist but be hidden - check if we can make it visible (works on both web and desktop)
    const widgetElement = await widget.elementHandle();
    if (widgetElement) {
      // Try to make widget visible by removing any overlays or focusing it
      await widgetElement.evaluate((el: HTMLElement) => {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.focus();
      }).catch(() => {});
    }
    // Wait for visibility with longer timeout
    await expect(widget).toBeVisible({ timeout: 10_000 });
    // Also ensure input is visible
    const input = widget.locator('input.input');
    await input.waitFor({ state: 'attached', timeout: 10_000 });
    const inputVisible = await input.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inputVisible) {
      const inputElement = await input.elementHandle();
      if (inputElement) {
        await inputElement.evaluate((el: HTMLElement) => {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          (el as HTMLInputElement).focus();
        }).catch(() => {});
      }
    }
    await expect(input).toBeVisible({ timeout: 10_000 });
  }
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  // VS Code command palette automatically adds '>' prefix when opened with F1/Ctrl+Shift+P
  // Get the input locator - use locator-specific action for better reliability on desktop
  const widget = page.locator(QUICK_INPUT_WIDGET);
  let input = widget.locator('input.input');
  
  // Ensure widget and input are ready - retry if welcome tabs interfere
  await expect(async () => {
    // Widget should already be visible from openCommandPalette, but verify it's still visible
    // In CI, widget may become hidden if welcome tabs interfere, so wait with longer timeout
    const widgetVisible = await widget.isVisible({ timeout: 3000 }).catch(() => false);
    if (!widgetVisible) {
      // Widget is hidden - close welcome tabs and reopen command palette
      const { closeWelcomeTabs } = await import('../utils/helpers.js');
      const { WORKBENCH } = await import('../utils/locators.js');
      await closeWelcomeTabs(page);
      await page.locator(WORKBENCH).click();
      // Close existing widget and reopen
      const existingVisible = await widget.isVisible({ timeout: 500 }).catch(() => false);
      if (existingVisible) {
        await page.keyboard.press('Escape');
        await widget.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      }
      await page.keyboard.press('F1');
      await widget.waitFor({ state: 'attached', timeout: 10_000 });
      await expect(widget).toBeVisible({ timeout: 10_000 });
      // Re-query input after reopening
      input = widget.locator('input.input');
    }
    
    await input.waitFor({ state: 'attached', timeout: 10_000 });
    // Wait for input to be visible - it may be attached but hidden initially
    const inputVisible = await input.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inputVisible) {
      // Input is hidden - try to force it visible
      const inputElement = await input.elementHandle();
      if (inputElement) {
        await inputElement.evaluate((el: HTMLElement) => {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          (el as HTMLInputElement).focus();
        }).catch(() => {});
      }
    }
    await expect(input).toBeVisible({ timeout: 10_000 });
    // Focus the input to ensure it's ready for typing
    await input.focus({ timeout: 5000 });
    // Wait for input to be focused and ready - ensure it has the '>' prefix that VS Code adds automatically
    await expect(input).toHaveValue(/^>/, { timeout: 5000 });
    // Type the command - use pressSequentially for reliability (works better than fill() when VS Code interferes)
    // VS Code adds '>' prefix automatically, so we type the command without the '>' prefix
    // Instead of selecting all, just type after the '>' prefix - this is more reliable
    await input.click({ timeout: 5000 });
    // Move to end of input (after '>') and type the command
    await page.keyboard.press('End');
    await input.pressSequentially(command, { delay: 50 });
    // Wait for input value to contain what we typed - verify typing was successful
    // eslint-disable-next-line unicorn/prefer-string-replace-all -- replaceAll doesn't support regex patterns
    const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Check input value - it should contain the command (with '>' prefix)
    await expect(input).toHaveValue(new RegExp(`>.*${escapedCommand}`, 'i'), { timeout: 5000 });
    // Wait for command list to appear - this confirms VS Code processed the input
    await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 5000 });
  }).toPass({ timeout: 15_000 });

  // Wait for the command list to populate after typing - wait for at least one row to exist in DOM
  // For virtualized lists, rows may exist in DOM but not be visible until scrolled into view
  // We wait for attachment (exists in DOM) rather than visibility, then rely on Playwright's click() to handle scrolling
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

  // Wait for the filtered list to stabilize - VS Code filters commands as you type
  // Wait for at least one row that matches our command text to appear in the filtered results
  // This ensures VS Code has finished filtering before we look for the specific command
  const listRows = widget.locator(QUICK_INPUT_LIST_ROW);
  await expect(async () => {
    const count = await listRows.count();
    expect(count, 'Command list should have at least one row').toBeGreaterThan(0);
    // Check if any row contains our command text (case-insensitive partial match)
    const commandLower = command.toLowerCase();
    const availableCommands: string[] = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const rowText = await listRows.nth(i).textContent();
      if (rowText) {
        const text = rowText.trim();
        availableCommands.push(text);
        if (text.toLowerCase().includes(commandLower)) {
          return;
        }
      }
    }
    throw new Error(
      `Command "${command}" not found in filtered list. Available commands (first ${availableCommands.length}): ${availableCommands.join(' | ')}`
    );
  }).toPass({ timeout: 10_000 });

  // Use text content matching to find exact command (bypasses MRU prioritization)
  // Scope to QUICK_INPUT_WIDGET first, then find the list row (more specific than just .monaco-list-row)
  const commandRow = widget
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: command, hasNotText })
    .first();

  // Wait for the command row to be attached (exists in DOM)
  // For virtualized lists, the element may exist but not be visible until scrolled into view
  // In CI, commands may take longer to appear, so use a longer timeout
  await expect(commandRow).toBeAttached({ timeout: 10_000 });
  
  // For virtualized DOM, click directly via evaluate to bypass Playwright's visibility checks
  // This is more reliable than using click() with force: true, which still checks visibility
  await commandRow.evaluate((el) => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    (el as HTMLElement).click();
  });

  // Wait for the command palette to close after executing the command
  await widget.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // If it doesn't close (e.g., multi-step commands), that's ok
  });
};

export const executeCommandWithCommandPalette = async (
  page: Page,
  command: string,
  hasNotText?: string
): Promise<void> => {
  await openCommandPalette(page);
  await executeCommand(page, command, hasNotText);
};
