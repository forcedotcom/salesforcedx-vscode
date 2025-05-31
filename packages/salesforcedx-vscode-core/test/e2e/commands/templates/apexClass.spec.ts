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

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});
test('create class', async ({ workbox, evaluateInVSCode, baseDir }) => {
  const CLASS_FOLDER_PATH = path.join('force-app', 'main', 'default', 'classes');

  await workbox.waitForTimeout(500);
  await evaluateInVSCode(async vscode => {
    await vscode.commands.executeCommand('workbench.action.showCommands');
  });

  await test.step('choose command', async () => {
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).fill('>SFDX: Create Apex Class');
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).press('Enter');
  });

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

    await workbox.screenshot({ path: path.join(baseDir, 'class_created.png') });

    // assert that the notification appears
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  await test.step('verify file is open', async () => {
    const [openFile] = await evaluateInVSCode(vscode =>
      vscode.window.visibleTextEditors.filter(editor => editor.document.uri.fsPath?.endsWith('Foo.cls'))
    );

    assert.deepEqual(openFile.document.uri.fsPath, path.resolve(path.join(baseDir, CLASS_FOLDER_PATH, 'Foo.cls')));
  });

  await test.step('verify file content', async () => {
    const [openFileText] = await evaluateInVSCode(vscode =>
      vscode.window.visibleTextEditors
        .filter(editor => editor.document.uri.fsPath?.endsWith('Foo.cls'))
        .map(editor => editor.document.getText())
    );
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
