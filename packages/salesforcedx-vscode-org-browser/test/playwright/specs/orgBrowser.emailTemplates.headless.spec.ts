/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { AuthInfo, Connection } from '@salesforce/core';
import {
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { RETRIEVE_TIMEOUT_MS } from '../constants';
import { OrgBrowserPage } from '../pages/orgBrowserPage';

const templates = [
  { folder: 'OrgBrowserClassicEmail', name: 'ClassicEmailProbe', uiType: 'Aloha', type: 'text' },
  { folder: 'OrgBrowserLightningEmail', name: 'LightningEmailProbe', uiType: 'SFX', type: 'custom' }
] as const;

test.setTimeout(RETRIEVE_TIMEOUT_MS);

test('Org Browser discovers and retrieves Classic and Lightning email templates without local files', async ({
  page
}) => {
  const org = await createDreamhouseOrg();
  const connection = await Connection.create({
    authInfo: await AuthInfo.create({ username: org.sessionContext.username }),
    connectionOptions: { version: '68.0' }
  });

  await test.step('seed both email folder types and templates in the org', async () => {
    expect(
      await connection.metadata.upsert('EmailTemplateSettings', {
        fullName: 'EmailTemplate',
        enableTemplateEnhancedFolderPref: true
      })
    ).toMatchObject({ success: true });
    expect(
      await connection.metadata.upsert('EmailFolder', {
        fullName: templates[0].folder,
        name: templates[0].folder,
        accessType: 'Public',
        publicFolderAccess: 'ReadWrite'
      })
    ).toMatchObject({ success: true });
    expect(
      await connection.metadata.upsert('EmailTemplateFolder', {
        fullName: templates[1].folder,
        name: templates[1].folder
      })
    ).toMatchObject({ success: true });
    await Promise.all(
      templates.map(async template => {
        expect(
          await connection.metadata.upsert('EmailTemplate', {
            fullName: `${template.folder}/${template.name}`,
            content: Buffer.from('Org Browser email discovery regression').toString('base64'),
            available: true,
            encodingKey: 'UTF-8',
            name: template.name,
            style: 'none',
            subject: 'Org Browser email discovery regression',
            type: template.type,
            uiType: template.uiType
          })
        ).toMatchObject({ success: true });
      })
    );
  });

  const browser = new OrgBrowserPage(page);
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await upsertScratchOrgAuthFieldsToSettings(page, org, () => browser.waitForProject());
  await ensureSecondarySideBarHidden(page);
  await browser.openOrgBrowser();
  await browser.applyTextFilter('EmailTemplate:');
  await browser.expandFolder('EmailTemplate', 1);

  await test.step('discover both org-only folders before retrieving either template', async () => {
    for (const template of templates) {
      const folder = await browser.getMetadataItem('EmailTemplate', template.folder, 2);
      await expect(folder, `${template.folder} should be discoverable without local email files`).toBeVisible();
    }
  });

  for (const template of templates) {
    await test.step(`retrieve ${template.uiType} template through Org Browser`, async () => {
      await browser.expandFolder(template.folder, 2);
      const item = await browser.getMetadataItem(template.folder, `${template.folder}/${template.name}`, 3);
      await expect(
        item.locator('.codicon-circle-large-outline'),
        'Template should initially exist only in the org'
      ).toBeVisible();
      await browser.clickRetrieveButton(item);
      await expect(page.getByRole('tab', { name: new RegExp(`${template.name}\\.email`) })).toBeVisible({
        timeout: RETRIEVE_TIMEOUT_MS
      });
      await expect(
        item.locator('.codicon-pass-filled'),
        'Retrieved template should be marked present locally'
      ).toBeVisible();
    });
  }

  await test.step('refresh preserves both folders after retrieval', async () => {
    const type = await browser.findMetadataType('EmailTemplate');
    await type.hover();
    await type.locator('[aria-label="Refresh Type"]').click();
    for (const template of templates) {
      await expect(await browser.getMetadataItem('EmailTemplate', template.folder, 2)).toBeVisible();
    }
  });
});
