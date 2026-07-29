/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { test } from '../fixtures/desktopFixtures';
import { OrgBrowserPage } from '../pages/orgBrowserPage';

const CUSTOM_TAB_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
  <customObject>true</customObject>
  <motif>Custom20: Airplane</motif>
</CustomTab>
`;

test.setTimeout(600_000);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
  await ensureSecondarySideBarHidden(page);
});

test('Org Browser updates workspace presence after source creation and deletion', async ({ page, workspaceDir }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  const tabDirectory = path.join(workspaceDir, 'force-app', 'main', 'default', 'tabs');
  const tabPath = path.join(tabDirectory, 'Broker__c.tab-meta.xml');

  await orgBrowserPage.openOrgBrowser();
  await orgBrowserPage.expandFolder('CustomTab');
  const brokerItem = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');
  const presenceIcon = brokerItem.locator('div.custom-view-tree-node-item-icon');

  await test.step('starts as org-only', async () => {
    await expect(presenceIcon).toContainClass('codicon-circle-large-outline');
  });

  await test.step('file creation updates the local-presence icon without manual refresh', async () => {
    await fs.mkdir(tabDirectory, { recursive: true });
    await fs.writeFile(tabPath, CUSTOM_TAB_SOURCE);
    await expect(presenceIcon).toContainClass('codicon-pass-filled', { timeout: 30_000 });
  });

  await test.step('file deletion restores org-only presence without manual refresh', async () => {
    await fs.unlink(tabPath);
    await expect(presenceIcon).toContainClass('codicon-circle-large-outline', { timeout: 30_000 });
  });
});
