/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createProject, openCommandPalette, runCommandPaletteCommand } from '@salesforce/salesforcedx-vscode-nuts';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vscode-test-playwright';

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});
test('create trigger', async ({ workbox, baseDir }) => {
  const TRIGGER_FOLDER_PATH = path.join('force-app', 'main', 'default', 'triggers');

  await workbox.waitForTimeout(2000); // need time for ext to load so the command is available
  await openCommandPalette(workbox);

  await runCommandPaletteCommand(workbox, 'SFDX: Create Apex Trigger');

  await test.step('enter name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('MyTrigger');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox.getByRole('option', { name: TRIGGER_FOLDER_PATH }).locator('a').click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Apex Trigger successfully ran'
    });

    // assert that the notification appears
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify file is open', async () => {
    const tab = workbox.getByRole('tab', { name: 'MyTrigger.trigger' });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  await test.step('verify file content', async () => {
    const filePath = path.resolve(path.join(baseDir, TRIGGER_FOLDER_PATH, 'MyTrigger.trigger'));
    const openFileText = await fs.promises.readFile(filePath, 'utf8');
    assert.deepEqual(
      openFileText,
      `trigger MyTrigger on SOBJECT (before insert) {

}`
    );
  });

  await test.step('verify meta.xml exists', async () => {
    const metaPath = path.resolve(path.join(baseDir, TRIGGER_FOLDER_PATH, 'MyTrigger.trigger-meta.xml'));
    let metaExists = true;
    try {
      await fs.promises.access(metaPath);
    } catch {
      metaExists = false;
    }
    assert.strictEqual(metaExists, true, 'Meta.xml file should exist');
  });
});
