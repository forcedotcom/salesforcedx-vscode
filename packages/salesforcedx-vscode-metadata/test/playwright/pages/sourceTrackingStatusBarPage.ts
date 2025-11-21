/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page, type Locator } from '@playwright/test';

type StatusBarCounts = {
  conflicts: number;
  remote: number;
  local: number;
};

export class SourceTrackingStatusBarPage {
  public readonly page: Page;
  public readonly statusBarItem: Locator;

  constructor(page: Page) {
    this.page = page;
    // Locate by aria-label pattern in the status bar (works in both web and desktop)
    // The status bar button always contains "arrow-down" followed by "arrow-up" in the aria-label
    this.statusBarItem = page.getByRole('button', { name: /arrow-down.*arrow-up/ });
  }

  /** Wait for status bar to be visible */
  public async waitForVisible(timeout = 30_000): Promise<void> {
    await this.statusBarItem.waitFor({ state: 'visible', timeout });
  }

  /** Get the current status bar label text */
  public async getText(): Promise<string> {
    // Try to get text from the inner label element (web), fall back to button itself (desktop)
    const label = this.statusBarItem.locator('.statusbar-item-label');
    const count = await label.count();
    const text = count > 0 ? await label.textContent() : await this.statusBarItem.textContent();
    return text ?? '';
  }

  /** Parse status bar counts from aria-label (works in both web and desktop) */
  public async getCounts(): Promise<StatusBarCounts> {
    const ariaLabel = await this.statusBarItem.getAttribute('aria-label');
    if (!ariaLabel) {
      throw new Error('Status bar item has no aria-label');
    }

    // Parse aria-label like: "94 arrow-down 0 arrow-up, **Remote Changes (94):** ..."
    // Or with conflicts: "2 warning 94 arrow-down 0 arrow-up, **Conflicts (2):** ..."

    const conflictsMatch = ariaLabel.match(/(\d+)\s+warning/);
    const remoteMatch = ariaLabel.match(/(\d+)\s+arrow-down/);
    const localMatch = ariaLabel.match(/(\d+)\s+arrow-up/);

    if (!remoteMatch || !localMatch) {
      throw new Error(`Could not parse status bar aria-label: "${ariaLabel}"`);
    }

    return {
      conflicts: conflictsMatch ? parseInt(conflictsMatch[1], 10) : 0,
      remote: parseInt(remoteMatch[1], 10),
      local: parseInt(localMatch[1], 10)
    };
  }

  /** Check if status bar has error (red) background indicating conflicts */
  public async hasErrorBackground(): Promise<boolean> {
    const classAttr = await this.statusBarItem.getAttribute('class');
    return classAttr?.includes('error-kind') ?? false;
  }

  /** Check if status bar has warning (yellow) background */
  public async hasWarningBackground(): Promise<boolean> {
    const classAttr = await this.statusBarItem.getAttribute('class');
    return classAttr?.includes('warning-kind') ?? false;
  }

  /** Wait for status bar to show expected counts (with polling) */
  public async waitForCounts(expected: Partial<StatusBarCounts>, timeout = 30_000): Promise<void> {
    await expect(async () => {
      const actual = await this.getCounts();

      if (expected.conflicts !== undefined && actual.conflicts !== expected.conflicts) {
        throw new Error(`Expected conflicts=${expected.conflicts}, got ${actual.conflicts}`);
      }
      if (expected.remote !== undefined && actual.remote !== expected.remote) {
        throw new Error(`Expected remote=${expected.remote}, got ${actual.remote}`);
      }
      if (expected.local !== undefined && actual.local !== expected.local) {
        throw new Error(`Expected local=${expected.local}, got ${actual.local}`);
      }
    }).toPass({ timeout });
  }

  /** Click the status bar item to trigger command */
  public async click(): Promise<void> {
    await this.statusBarItem.click();
  }

  /** Get the hover tooltip text */
  public async getTooltip(): Promise<string> {
    // Use the aria-label which contains the full tooltip text
    const ariaLabel = await this.statusBarItem.getAttribute('aria-label');
    return ariaLabel ?? '';
  }
}
