/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  isDesktop,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test as desktopTest } from '../fixtures/desktopFixtures';
import { OrgBrowserPage } from '../pages/orgBrowserPage';

(isDesktop() ? desktopTest : desktopTest.skip.bind(desktopTest))(
  'Org Browser loads ApexClass with orphaned metadata XML and marks its source absent',
  async ({ page, workspaceDir }) => {
    desktopTest.setTimeout(600_000);
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    const sourcePath = path.join(classesDir, 'PropertyController.cls');

    await desktopTest.step('create orphaned ApexClass metadata XML', async () => {
      await fs.mkdir(classesDir, { recursive: true });
      await expect(fs.access(sourcePath)).rejects.toThrow();
      await fs.writeFile(
        `${sourcePath}-meta.xml`,
        '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>64.0</apiVersion><status>Active</status></ApexClass>'
      );
    });

    const orgBrowserPage = new OrgBrowserPage(page);
    await desktopTest.step('open Org Browser with Dreamhouse org', async () => {
      const createResult = await createDreamhouseOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
      await ensureSecondarySideBarHidden(page);
      await orgBrowserPage.openOrgBrowser();
    });

    await desktopTest.step('expand ApexClass and check the missing-source indicator', async () => {
      await orgBrowserPage.findMetadataType('ApexClass');
      await orgBrowserPage.expandFolder('ApexClass');
      const item = await orgBrowserPage.getMetadataItem('ApexClass', 'PropertyController');
      await expect(item, 'PropertyController should load despite its orphaned XML').toBeVisible();
      await expect(item.locator('div.custom-view-tree-node-item-icon'), 'Source file is absent').toContainClass(
        'codicon-circle-large-outline'
      );
    });
  }
);
