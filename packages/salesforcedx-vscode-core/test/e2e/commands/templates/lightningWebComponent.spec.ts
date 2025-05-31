/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createProject } from '@salesforce/salesforcedx-vscode-nuts';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vscode-test-playwright';

const LWC_FOLDER_PATH = path.join('force-app', 'main', 'default', 'lwc', 'lightningWebComponent1');

const expectedFiles = [
  'lightningWebComponent1.html',
  'lightningWebComponent1.js',
  'lightningWebComponent1.js-meta.xml'
];

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Lightning Web Component', async ({ workbox, evaluateInVSCode, baseDir }) => {
  await workbox.waitForTimeout(500);
  await evaluateInVSCode(async vscode => {
    await vscode.commands.executeCommand('workbench.action.showCommands');
  });

  await test.step('choose command', async () => {
    await workbox
      .getByRole('textbox', { name: 'Type the name of a command to' })
      .fill('>SFDX: Create Lightning Web Component');
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).press('Enter');
  });

  await test.step('enter component name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('lightningWebComponent1');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox
      .getByRole('option', { name: path.join('force-app', 'main', 'default', 'lwc') })
      .locator('a')
      .click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Lightning Web Component successfully ran'
    });
    await workbox.screenshot({ path: path.join(baseDir, 'lwc_component_created.png') });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify directory exists', async () => {
    const dirExists = fs.existsSync(path.resolve(path.join(baseDir, LWC_FOLDER_PATH)));
    assert.strictEqual(dirExists, true, 'lightningWebComponent1 directory should exist');
  });

  for (const file of expectedFiles) {
    await test.step(`verify ${file} exists`, async () => {
      const filePath = path.resolve(path.join(baseDir, LWC_FOLDER_PATH, file));
      const exists = fs.existsSync(filePath);
      assert.strictEqual(exists, true, `${file} should exist`);
    });
  }

  await test.step('verify .js file content', async () => {
    const [openFileText] = await evaluateInVSCode(vscode =>
      vscode.window.visibleTextEditors
        .filter(editor => editor.document.uri.fsPath?.endsWith('lightningWebComponent1.js'))
        .map(editor => editor.document.getText())
    );
    const expectedText = [
      "import { LightningElement } from 'lwc';",
      '',
      'export default class LightningWebComponent1 extends LightningElement {}'
    ].join('\n');
    assert.strictEqual(openFileText.trimEnd().replace(/\r\n/g, '\n'), expectedText);
  });
});
