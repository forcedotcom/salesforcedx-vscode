/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  openFileFromExplorerTree,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import * as Duration from 'effect/Duration';

import { outlineTest as test } from '../fixtures';

/** Outline populates when the external TS Apex LS has published document symbols. */
const OUTLINE_READY_TIMEOUT = Duration.seconds(120);

test('Apex Outline shows class and method symbols', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('open seeded ExampleClass.cls', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await waitForWorkspaceReady(page);
    await openFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes']);
  });

  await test.step('Outline view shows the class and method', async () => {
    const outlineHeader = page.getByRole('button', { name: 'Outline Section', exact: true });
    await expect(outlineHeader).toBeVisible({ timeout: Duration.toMillis(Duration.seconds(30)) });
    await ((await outlineHeader.getAttribute('aria-expanded')) === 'true' ? undefined : outlineHeader.click());

    const outline = page.locator('.outline-pane');
    await expect(async () => {
      const classItem = outline.getByRole('treeitem', { name: /ExampleClass/ }).first();
      await expect(classItem).toBeVisible();
      await ((await classItem.getAttribute('aria-expanded')) === 'false' ? classItem.click() : undefined);
      await expect(outline.getByRole('treeitem', { name: /SayHello/ }).first()).toBeVisible();
    }).toPass({ timeout: Duration.toMillis(OUTLINE_READY_TIMEOUT) });
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
