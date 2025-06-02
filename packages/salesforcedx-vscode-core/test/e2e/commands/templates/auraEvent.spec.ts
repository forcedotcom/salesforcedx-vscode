/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@mshanemc/vscode-test-playwright';
import { createProject } from '@salesforce/salesforcedx-vscode-nuts';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const AURA_EVENT_FOLDER_PATH = path.join('force-app', 'main', 'default', 'aura', 'auraEvent1');

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Aura Event', async ({ workbox, evaluateInVSCode, baseDir }) => {
  await workbox.waitForTimeout(500);
  await evaluateInVSCode(async vscode => {
    await vscode.commands.executeCommand('workbench.action.showCommands');
  });

  await test.step('choose command', async () => {
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).fill('>SFDX: Create Aura Event');
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).press('Enter');
  });

  await test.step('enter event name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('auraEvent1');
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
      hasText: 'Create Aura Event successfully ran'
    });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify directory exists', async () => {
    const dirExists = fs.existsSync(path.resolve(path.join(baseDir, AURA_EVENT_FOLDER_PATH)));
    assert.strictEqual(dirExists, true, 'auraEvent1 directory should exist');
  });

  await test.step('verify .evt file exists', async () => {
    const evtExists = fs.existsSync(path.resolve(path.join(baseDir, AURA_EVENT_FOLDER_PATH, 'auraEvent1.evt')));
    assert.strictEqual(evtExists, true, 'auraEvent1.evt should exist');
  });

  await test.step('verify .evt-meta.xml file exists', async () => {
    const metaExists = fs.existsSync(
      path.resolve(path.join(baseDir, AURA_EVENT_FOLDER_PATH, 'auraEvent1.evt-meta.xml'))
    );
    assert.strictEqual(metaExists, true, 'auraEvent1.evt-meta.xml should exist');
  });

  await test.step('verify .evt file content', async () => {
    const [openFileText] = await evaluateInVSCode(vscode =>
      vscode.window.visibleTextEditors
        .filter(editor => editor.document.uri.fsPath?.endsWith('auraEvent1.evt'))
        .map(editor => editor.document.getText())
    );
    const expectedText = '<aura:event type="APPLICATION" description="Event template" />';
    assert.strictEqual(openFileText.trimEnd().replace(/\r\n/g, '\n'), expectedText);
  });
});
