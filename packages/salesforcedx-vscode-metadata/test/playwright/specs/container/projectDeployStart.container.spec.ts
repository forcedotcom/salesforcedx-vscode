/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for Push Source to Default Org. The web twin
 * (projectDeployStart.headless.spec.ts) proves the command runs and reports success via the output
 * channel against a plain Page. This proves the push actually reaches the org from inside the Code
 * Builder image using the container's boot-authed org.
 *
 * Deploy-on-save is disabled first so an edit+save creates a persistent local change (rather than
 * being auto-deployed before the push). The seeded fixture class (PagedResult.cls) is edited with a
 * unique comment to guarantee there is something to push, then success is confirmed via the
 * "Starting metadata deployment" and "Deployed Source" output-channel lines.
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  editOpenFile,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileFromExplorerTree,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../../src/constants';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Project Deploy Start (Code Builder): pushes source to the boot org', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'projectDeployStart.container.01-ready.png');
  });

  await test.step('disable deploy-on-save so the edit is not auto-deployed', async () => {
    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
  });

  await test.step('create a local change by editing the fixture class', async () => {
    await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await editOpenFile(page, `// Project deploy start container test ${Date.now()}`);
    await saveScreenshot(page, 'projectDeployStart.container.02-after-edit.png');
  });

  await test.step('push to org and confirm success via output channel', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_default_org_text);
    await saveScreenshot(page, 'projectDeployStart.container.03-after-command.png');

    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await saveScreenshot(page, 'projectDeployStart.container.04-deploy-started.png');

    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'projectDeployStart.container.05-deployed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
