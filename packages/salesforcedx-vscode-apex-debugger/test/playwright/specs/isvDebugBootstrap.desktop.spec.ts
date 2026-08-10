/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * "SFDX: Create and Set Up Project for ISV Debugging" (sf.debug.isv.bootstrap).
 *
 * SCOPE CONSTRAINT: a full ISV bootstrap needs a live, ISV-licensed subscriber session (a forceide:// URL with
 * a valid `sessionId` + `url`). The `project retrieve start` and `package installed list` steps then hit that
 * subscriber org — none of this is automatable in CI (no ISV-licensed org). This spec therefore drives ONLY the
 * command-availability + gatherer-cancel path that runs with no org: it asserts the command is contributed and
 * that cancelling the forceide:// prompt exits cleanly (no project scaffolded, no crash). The
 * `project:generate` + `config:set` + launch.json on-disk assertions and the retrieve/package steps are
 * MANUAL-VERIFY against a real ISV org (see plans/W-23451863.md "Verification").
 */

import { expect } from '@playwright/test';
import {
  executeCommandWithCommandPalette,
  isDesktop,
  prepareNoFolderOpenForPaletteTests,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { debuggerEmptyWorkspaceDesktopTest as test } from '../fixtures';
import packageNls from '../../../package.nls.json';

(isDesktop() ? test : test.skip.bind(test))(
  'ISV Debugger Bootstrap: command available; forceide prompt cancels cleanly',
  async ({ page }) => {
    test.setTimeout(60_000);

    await test.step('reach empty-workspace palette state', async () => {
      await prepareNoFolderOpenForPaletteTests(page);
      await saveScreenshot(page, 'isvBootstrap.01-empty-workspace.png');
    });

    await test.step('verify ISV bootstrap command available', async () => {
      await verifyCommandExists(page, packageNls.isv_bootstrap_command_text, 60_000);
    });

    await test.step('run command, then cancel at the forceide:// prompt', async () => {
      await executeCommandWithCommandPalette(page, packageNls.isv_bootstrap_command_text);
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await saveScreenshot(page, 'isvBootstrap.02-forceide-prompt.png');
      // Esc cancels the gatherer → UserCancellationError, silently swallowed by registerCommandWithRuntime.
      await page.keyboard.press('Escape');
      await expect(quickInput).not.toBeVisible({ timeout: 10_000 });
      await saveScreenshot(page, 'isvBootstrap.03-cancelled.png');
    });
  }
);
