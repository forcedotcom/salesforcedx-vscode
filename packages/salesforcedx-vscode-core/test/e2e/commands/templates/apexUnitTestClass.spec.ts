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

const CLASS_FOLDER_PATH = path.join('force-app', 'main', 'default', 'classes');

// Project setup

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Apex Unit Test Class', async ({ workbox, baseDir }) => {
  await workbox.waitForTimeout(2000);
  await openCommandPalette(workbox);

  await runCommandPaletteCommand(workbox, 'SFDX: Create Apex Unit Test Class');

  await test.step('enter class name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('ApexUnitTestClass1');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox.getByRole('option', { name: CLASS_FOLDER_PATH }).locator('a').click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Apex Unit Test Class successfully ran'
    });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify .cls file is open', async () => {
    const tab = workbox.getByRole('tab', { name: 'ApexUnitTestClass1.cls' });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  await test.step('verify .cls file content', async () => {
    const filePath = path.resolve(path.join(baseDir, CLASS_FOLDER_PATH, 'ApexUnitTestClass1.cls'));
    const openFileText = await fs.promises.readFile(filePath, 'utf8');
    const expectedText = [
      '@isTest',
      'private class ApexUnitTestClass1 {',
      '',
      '    @isTest',
      '    static void myUnitTest() {',
      '        // TO DO: implement unit test',
      '    }',
      '}'
    ].join('\n');
    assert.ok(openFileText.includes(expectedText), 'ApexUnitTestClass1.cls should contain the expected template');
  });

  await test.step('verify meta.xml exists', async () => {
    const metaPath = path.resolve(path.join(baseDir, CLASS_FOLDER_PATH, 'ApexUnitTestClass1.cls-meta.xml'));
    let metaExists = true;
    try {
      await fs.promises.access(metaPath);
    } catch {
      metaExists = false;
    }
    assert.strictEqual(metaExists, true, 'Meta.xml file should exist');
  });
});
