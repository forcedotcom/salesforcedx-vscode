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

const AURA_INTERFACE_FOLDER_PATH = path.join('force-app', 'main', 'default', 'aura', 'AuraInterface1');

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Aura Interface', async ({ workbox, evaluateInVSCode, baseDir }) => {
  await workbox.waitForTimeout(500);
  await evaluateInVSCode(async vscode => {
    await vscode.commands.executeCommand('workbench.action.showCommands');
  });

  await test.step('choose command', async () => {
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).fill('>SFDX: Create Aura Interface');
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).press('Enter');
  });

  await test.step('enter interface name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('AuraInterface1');
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
      hasText: 'Create Aura Interface successfully ran'
    });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify .intf file exists', async () => {
    const intfExists = fs.existsSync(
      path.resolve(path.join(baseDir, AURA_INTERFACE_FOLDER_PATH, 'AuraInterface1.intf'))
    );
    assert.strictEqual(intfExists, true, 'AuraInterface1.intf should exist');
  });

  await test.step('verify .intf-meta.xml file exists', async () => {
    const metaExists = fs.existsSync(
      path.resolve(path.join(baseDir, AURA_INTERFACE_FOLDER_PATH, 'AuraInterface1.intf-meta.xml'))
    );
    assert.strictEqual(metaExists, true, 'AuraInterface1.intf-meta.xml should exist');
  });

  await test.step('verify .intf file content', async () => {
    const [openFileText] = await evaluateInVSCode(vscode =>
      vscode.window.visibleTextEditors
        .filter(editor => editor.document.uri.fsPath?.endsWith('AuraInterface1.intf'))
        .map(editor => editor.document.getText())
    );
    const expectedText = [
      '<aura:interface description="Interface template">',
      '  <aura:attribute name="example" type="String" default="" description="An example attribute."/>',
      '</aura:interface>'
    ].join('\n');
    assert.strictEqual(openFileText.trimEnd().replace(/\r\n/g, '\n'), expectedText);
  });
});
