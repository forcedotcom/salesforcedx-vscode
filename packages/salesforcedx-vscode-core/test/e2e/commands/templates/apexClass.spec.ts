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

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});
test('create class', async ({ workbox, baseDir }) => {
  const CLASS_FOLDER_PATH = path.join('force-app', 'main', 'default', 'classes');

  await workbox.waitForTimeout(startupWait); // need time for ext to load so the command is available
  await openCommandPalette(workbox);

  await runCommandPaletteCommand(workbox, 'SFDX: Create Apex Class');

  await test.step('enter class name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('Foo');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox.getByRole('option', { name: CLASS_FOLDER_PATH }).locator('a').click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Apex Class successfully ran'
    });

    // assert that the notification appears
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify file is open', async () => {
    const tab = workbox.getByRole('tab', { name: 'Foo.cls' });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  await test.step('verify file content', async () => {
    const filePath = path.resolve(path.join(baseDir, CLASS_FOLDER_PATH, 'Foo.cls'));
    const openFileText = fs.readFileSync(filePath, 'utf8');
    assert.deepEqual(
      openFileText,
      `public with sharing class Foo {
    public Foo() {

    }
}`
    );
  });

  await test.step('verify meta.xml exists', async () => {
    const metaPath = path.resolve(path.join(baseDir, CLASS_FOLDER_PATH, 'Foo.cls-meta.xml'));
    const metaExists = fs.existsSync(metaPath);
    assert.strictEqual(metaExists, true, 'Meta.xml file should exist');
  });
});
