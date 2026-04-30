/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  prepareNoFolderOpenForPaletteTests,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import {
  desktopTest as testNoFolderOpen,
  folderWithoutSfdxProjectTest as testEmptyFolder
} from '../fixtures/desktopFixtures';

const assertCreateProjectCommands = async (page: Parameters<typeof verifyCommandExists>[0]): Promise<void> => {
  await verifyCommandExists(page, packageNls.project_generate_text, 120_000);
  await verifyCommandExists(page, packageNls.project_generate_with_manifest_text, 120_000);
};

testNoFolderOpen('SFDX Create Project commands: no folder open (workspace closed)', async ({ page }) => {
  testNoFolderOpen.setTimeout(120_000);
  await prepareNoFolderOpenForPaletteTests(page);
  await assertCreateProjectCommands(page);
});

testEmptyFolder('SFDX Create Project commands: folder open without sfdx-project.json', async ({ page }) => {
  testEmptyFolder.setTimeout(120_000);
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await assertCreateProjectCommands(page);
});
