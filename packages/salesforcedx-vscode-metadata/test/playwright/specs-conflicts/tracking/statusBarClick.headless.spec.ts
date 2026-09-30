/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { trackingConflictTest as test } from '../../fixtures';
import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  createApexClass,
  ensureOutputPanelOpen,
  saveScreenshot,
  selectOutputChannel,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../../constants';

// Conflicts project timeout is shorter than retrieve then deploy.
test.setTimeout(RETRIEVE_TIMEOUT + DEPLOY_TIMEOUT);

test('status bar click retrieves then deploys', async ({ page, helperProject, statusBarPage }) => {
  await test.step('require local 0 and conflicts 0', async () => {
    await statusBarPage.waitForVisible(120_000);
    const counts = await statusBarPage.getCounts();
    await saveScreenshot(page, `initial-${counts.local}-${counts.remote}-${counts.conflicts}.png`);
    expect(counts.local, 'local must be 0 before any status bar click').toBe(0);
    expect(counts.conflicts, 'conflicts must be 0 before any status bar click').toBe(0);
  });

  await test.step('remote entry', async () => {
    const counts = await statusBarPage.getCounts();
    // Earlier specs can leave remote members on minimalTestOrg. Leave an existing remote count.
    if (counts.remote === 0) {
      const className = `RemoteClick${Date.now().toString(36).slice(-6).toUpperCase()}`;
      await helperProject(className, `public class ${className} {}`);
      await statusBarPage.waitForCounts({ remote: 1, local: 0, conflicts: 0 }, 60_000);
    }
  });

  await test.step('click retrieves when remote > 0, local 0, conflicts 0', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    const counts = await statusBarPage.getCounts();
    expect(counts.remote, 'retrieve click requires remote > 0').toBeGreaterThan(0);
    expect(counts.local, 'retrieve click requires local 0').toBe(0);
    expect(counts.conflicts, 'retrieve click requires conflicts 0').toBe(0);
    await saveScreenshot(page, `retrieve-click-${counts.local}-${counts.remote}-${counts.conflicts}.png`);

    await statusBarPage.click();
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    await statusBarPage.waitForCounts({ remote: 0, local: 0, conflicts: 0 }, 60_000);
    await saveScreenshot(page, 'retrieve-complete.png');
  });

  await test.step('local entry', async () => {
    const className = `LocalClick${Date.now().toString(36).slice(-6).toUpperCase()}`;
    await createApexClass(page, className);
    await statusBarPage.waitForCounts({ local: 1, remote: 0, conflicts: 0 }, 60_000);
    const counts = await statusBarPage.getCounts();
    expect(counts.remote, 'do not click deploy when remote is not 0').toBe(0);
    expect(counts.conflicts, 'do not click deploy when conflicts is not 0').toBe(0);
    await saveScreenshot(page, `local-entry-${counts.local}-${counts.remote}-${counts.conflicts}.png`);
  });

  await test.step('click deploys when local 1, remote 0, conflicts 0', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    const counts = await statusBarPage.getCounts();
    expect(counts.local, 'deploy click requires local 1').toBe(1);
    expect(counts.remote, 'deploy click requires remote 0').toBe(0);
    expect(counts.conflicts, 'deploy click requires conflicts 0').toBe(0);
    await saveScreenshot(page, `deploy-click-${counts.local}-${counts.remote}-${counts.conflicts}.png`);

    await statusBarPage.click();
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await statusBarPage.waitForCounts({ local: 0, remote: 0, conflicts: 0 }, 60_000);
    await saveScreenshot(page, 'deploy-complete.png');
  });
});
