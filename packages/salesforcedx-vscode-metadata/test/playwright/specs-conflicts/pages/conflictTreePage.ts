/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';

export class ConflictTreePage {
  constructor(private readonly page: Page) {}

  public async waitForItem(fileName: string, timeout = 10_000): Promise<void> {
    await expect(
      this.page.getByRole('treeitem', { name: new RegExp(`${fileName.replaceAll('.', '\\.')}(?![-.\\w])`) }),
      `Conflict tree should show ${fileName}`
    ).toBeVisible({ timeout });
  }

  public async clickItem(fileName: string): Promise<void> {
    await this.page
      .getByRole('treeitem', { name: new RegExp(`${fileName.replaceAll('.', '\\.')}(?![-.\\w])`) })
      .click();
  }

  public async waitForItemGone(fileName: string, timeout = 30_000): Promise<void> {
    await expect(
      this.page.getByRole('treeitem', { name: new RegExp(`${fileName.replaceAll('.', '\\.')}(?![-.\\w])`) }),
      `Conflict tree should no longer show ${fileName}`
    ).not.toBeVisible({ timeout });
  }
}
