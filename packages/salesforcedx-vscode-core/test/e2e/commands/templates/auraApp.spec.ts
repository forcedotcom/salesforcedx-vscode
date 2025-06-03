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
import { startupWait } from '../../playwright.config';

const AURA_FOLDER_PATH = path.join('force-app', 'main', 'default', 'aura', 'AuraApp1');

const expectedFiles = [
  'AuraApp1.app',
  'AuraApp1.app-meta.xml',
  'AuraApp1.auradoc',
  'AuraApp1.css',
  'AuraApp1.svg',
  'AuraApp1Controller.js',
  'AuraApp1Helper.js',
  'AuraApp1Renderer.js'
];

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Aura App', async ({ workbox, baseDir }) => {
  await workbox.waitForTimeout(startupWait);
  await openCommandPalette(workbox);

  await runCommandPaletteCommand(workbox, 'SFDX: Create Aura App');

  await test.step('enter app name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('AuraApp1');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox
      .getByRole('option', { name: path.join('force-app', 'main', 'default', 'aura') })
      .locator('a')
      .click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Aura App successfully ran'
    });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  for (const file of expectedFiles) {
    await test.step(`verify ${file} exists`, () => {
      const filePath = path.resolve(path.join(baseDir, AURA_FOLDER_PATH, file));
      assert.strictEqual(fs.existsSync(filePath), true, `${file} should exist`);
    });
  }

  await test.step('verify .app file content', async () => {
    const filePath = path.resolve(path.join(baseDir, AURA_FOLDER_PATH, 'AuraApp1.app'));
    const openFileText = fs.readFileSync(filePath, 'utf8');
    const expectedText = ['<aura:application>', '', '</aura:application>'].join('\n');
    assert.strictEqual(openFileText.trimEnd().replace(/\r\n/g, '\n'), expectedText);
  });
});
