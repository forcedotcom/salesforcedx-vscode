/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';

const itemRegex = (fileName: string) =>
  new RegExp(`${fileName.replaceAll('.', '\\.')}(?![-.\\w])`);

export class ConflictTreePage {
  constructor(private readonly page: Page) {}

  private conflictsTree() {
    return this.page.getByRole('tree', { name: 'Conflicts' });
  }

  public async waitForItem(fileName: string, timeout = 10_000): Promise<void> {
    await expect(
      this.conflictsTree().getByRole('treeitem', { name: itemRegex(fileName) }),
      `Conflict tree should show ${fileName}`
    ).toBeVisible({ timeout });
  }

  public async clickItem(fileName: string): Promise<void> {
    await this.conflictsTree()
      .getByRole('treeitem', { name: itemRegex(fileName) })
      .click();
  }

  public async waitForItemGone(fileName: string, timeout = 30_000): Promise<void> {
    await expect(async () => {
      const tree = this.conflictsTree();
      if (!(await tree.isVisible().catch(() => false))) return;
      await expect(
        tree.getByRole('treeitem', { name: itemRegex(fileName) }),
        `Conflict tree should no longer show ${fileName}`
      ).not.toBeVisible({ timeout: 2000 });
    }).toPass({ timeout });
  }
}
