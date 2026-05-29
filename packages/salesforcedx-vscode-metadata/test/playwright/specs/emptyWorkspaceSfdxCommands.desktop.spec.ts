/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  isDesktop,
  prepareNoFolderOpenForPaletteTests,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { emptyWorkspaceDesktopTest as test } from '../fixtures';

const assertCreateProjectCommands = async (page: Parameters<typeof verifyCommandExists>[0]): Promise<void> => {
  await verifyCommandExists(page, packageNls.project_generate_text, 120_000);
  await verifyCommandExists(page, packageNls.project_generate_with_manifest_text, 120_000);
};

// Register as skipped in web runs — the empty-workspace fixture launches Electron, which can't run on web.
const desktopOnlyTest = isDesktop() ? test : test.skip.bind(test);

desktopOnlyTest('SFDX Create Project commands: no folder open (workspace closed)', async ({ page }) => {
  test.setTimeout(120_000);
  await prepareNoFolderOpenForPaletteTests(page);
  await assertCreateProjectCommands(page);
});

desktopOnlyTest('SFDX Create Project commands: folder open without sfdx-project.json', async ({ page }) => {
  test.setTimeout(120_000);
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await assertCreateProjectCommands(page);
});
