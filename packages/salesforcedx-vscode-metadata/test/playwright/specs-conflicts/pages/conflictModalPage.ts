/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { messages as i18n } from '../../../../src/messages/i18n';

export class ConflictModalPage {
  constructor(private readonly page: Page) {}

  public async waitForVisible(operationType: 'deploy' | 'retrieve', timeout = 60_000): Promise<void> {
    const label =
      operationType === 'deploy'
        ? i18n.conflict_detect_show_conflicts_deploy
        : i18n.conflict_detect_show_conflicts_retrieve;
    await expect(this.page.getByRole('button', { name: label }), 'Conflict modal should be visible').toBeVisible({
      timeout
    });
  }

  public async clickViewConflicts(operationType: 'deploy' | 'retrieve'): Promise<void> {
    const label =
      operationType === 'deploy'
        ? i18n.conflict_detect_show_conflicts_deploy
        : i18n.conflict_detect_show_conflicts_retrieve;
    await this.page.getByRole('button', { name: label }).click();
  }

  public async clickOverride(operationType: 'deploy' | 'retrieve'): Promise<void> {
    const label =
      operationType === 'deploy' ? i18n.conflict_detect_override_deploy : i18n.conflict_detect_override_retrieve;
    await this.page.getByRole('button', { name: label }).click();
  }
}
