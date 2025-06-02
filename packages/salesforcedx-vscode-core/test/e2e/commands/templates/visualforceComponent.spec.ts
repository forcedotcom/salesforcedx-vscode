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

const COMPONENT_FOLDER_PATH = path.join('force-app', 'main', 'default', 'components');

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Visualforce Component', async ({ workbox, baseDir }) => {
  await workbox.waitForTimeout(2000);
  await openCommandPalette(workbox);
  await runCommandPaletteCommand(workbox, 'SFDX: Create Visualforce Component');

  await test.step('enter component name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('VisualforceCmp1');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox.getByRole('option', { name: COMPONENT_FOLDER_PATH }).locator('a').click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Visualforce Component successfully ran'
    });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify .component file is open', async () => {
    const tab = workbox.getByRole('tab', { name: 'VisualforceCmp1.component' });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  await test.step('verify .component file content', async () => {
    const filePath = path.resolve(path.join(baseDir, COMPONENT_FOLDER_PATH, 'VisualforceCmp1.component'));
    const openFileText = await fs.promises.readFile(filePath, 'utf8');
    const expectedText = [
      '<apex:component >',
      '<!-- Begin Default Content REMOVE THIS -->',
      '<h1>Congratulations</h1>',
      'This is your new Component',
      '<!-- End Default Content REMOVE THIS -->',
      '</apex:component>'
    ].join('\n');
    assert.strictEqual(openFileText.trimEnd().replace(/\r\n/g, '\n'), expectedText);
  });

  await test.step('verify meta.xml exists', async () => {
    const metaPath = path.resolve(path.join(baseDir, COMPONENT_FOLDER_PATH, 'VisualforceCmp1.component-meta.xml'));
    const metaExists = fs.existsSync(metaPath);
    assert.strictEqual(metaExists, true, 'Meta.xml file should exist');
  });
});
