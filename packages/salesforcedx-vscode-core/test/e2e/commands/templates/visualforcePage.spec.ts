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

const PAGE_FOLDER_PATH = path.join('force-app', 'main', 'default', 'pages');

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Visualforce Page', async ({ workbox, evaluateInVSCode, baseDir }) => {
  await workbox.waitForTimeout(500);
  await evaluateInVSCode(async vscode => {
    await vscode.commands.executeCommand('workbench.action.showCommands');
  });

  await test.step('choose command', async () => {
    await workbox
      .getByRole('textbox', { name: 'Type the name of a command to' })
      .fill('>SFDX: Create Visualforce Page');
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).press('Enter');
  });

  await test.step('enter page name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('VisualforcePage1');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox.getByRole('option', { name: PAGE_FOLDER_PATH }).locator('a').click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Visualforce Page successfully ran'
    });
    await workbox.screenshot({ path: path.join(baseDir, 'vf_page_created.png') });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify .page file is open', async () => {
    const [openFile] = await evaluateInVSCode(vscode =>
      vscode.window.visibleTextEditors.filter(editor => editor.document.uri.fsPath?.endsWith('VisualforcePage1.page'))
    );
    assert.deepEqual(
      openFile.document.uri.fsPath,
      path.resolve(path.join(baseDir, PAGE_FOLDER_PATH, 'VisualforcePage1.page'))
    );
  });

  await test.step('verify .page file content', async () => {
    const [openFileText] = await evaluateInVSCode(vscode =>
      vscode.window.visibleTextEditors
        .filter(editor => editor.document.uri.fsPath?.endsWith('VisualforcePage1.page'))
        .map(editor => editor.document.getText())
    );
    const expectedText = [
      '<apex:page >',
      '<!-- Begin Default Content REMOVE THIS -->',
      '<h1>Congratulations</h1>',
      'This is your new Page',
      '<!-- End Default Content REMOVE THIS -->',
      '</apex:page>'
    ].join('\n');
    assert.strictEqual(openFileText.trimEnd().replace(/\r\n/g, '\n'), expectedText);
  });

  await test.step('verify meta.xml exists', async () => {
    const metaPath = path.resolve(path.join(baseDir, PAGE_FOLDER_PATH, 'VisualforcePage1.page-meta.xml'));
    const metaExists = fs.existsSync(metaPath);
    assert.strictEqual(metaExists, true, 'Meta.xml file should exist');
  });
});
