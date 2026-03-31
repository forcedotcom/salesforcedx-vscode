/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';

export class DiffEditorPage {
  constructor(private readonly page: Page) {}

  /** Wait for diff tab with title: "remote//FileName.cls ↔ local//FileName.cls" */
  public async waitForTab(fileName: string, timeout = 10_000): Promise<void> {
    await expect(
      this.page.getByRole('tab', { name: new RegExp(`${fileName}.*↔`) }),
      `Diff editor tab should open for ${fileName}`
    ).toBeVisible({ timeout });
  }
}
