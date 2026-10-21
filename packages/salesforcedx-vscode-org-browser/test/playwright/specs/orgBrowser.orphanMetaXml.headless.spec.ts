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
  NOTIFICATION_LIST_ITEM,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test as desktopTest } from '../fixtures/desktopFixtures';
import { OrgBrowserPage } from '../pages/orgBrowserPage';

(isDesktop() ? desktopTest : desktopTest.skip.bind(desktopTest))(
  'Org Browser marks workspace presence unknown when an Apex source file is deleted',
  async ({ page, workspaceDir }) => {
    desktopTest.setTimeout(600_000);
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    const sourcePath = path.join(classesDir, 'PropertyController.cls');

    await desktopTest.step('create an ApexClass source file and sidecar', async () => {
      await fs.mkdir(classesDir, { recursive: true });
      await expect(fs.access(sourcePath)).rejects.toThrow();
      await fs.writeFile(sourcePath, 'public with sharing class PropertyController {}');
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

    await desktopTest.step('confirm local presence, delete source, and report the failed scan', async () => {
      await orgBrowserPage.findMetadataType('ApexClass');
      await orgBrowserPage.expandFolder('ApexClass');
      const item = await orgBrowserPage.getMetadataItem('ApexClass', 'PropertyController');
      const indicator = item.locator('div.custom-view-tree-node-item-icon');
      await expect(item, 'PropertyController should load before its source is deleted').toBeVisible();
      await expect(indicator, 'The source file is present').toContainClass('codicon-pass-filled');

      await fs.unlink(sourcePath);
      await expect(fs.access(sourcePath)).rejects.toThrow();
      const apexClass = await orgBrowserPage.findMetadataType('ApexClass');
      await apexClass.hover();
      await apexClass.getByRole('button', { name: 'Refresh Type' }).click();

      const notification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({
          hasText:
            /Could not check workspace presence for ApexClass: .*PropertyController\.cls-meta\.xml has no matching content file .*PropertyController\.cls/
        })
        .first();
      await expect(notification).toBeVisible({ timeout: 30_000 });
      await expect(notification).toContainText('PropertyController.cls-meta.xml');
      await expect(notification).toContainText('PropertyController.cls');
      await expect(notification.locator('.codicon-error')).toBeVisible();
      await expect(item, 'The Org Browser component remains visible').toBeVisible();
      await expect(indicator, 'Unknown workspace presence should use a question-mark icon').toContainClass(
        'codicon-question'
      );
    });
  }
);
