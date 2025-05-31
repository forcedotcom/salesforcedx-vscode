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
import * as analyticsTemplate from './testData/sampleAnalyticsTemplateData';

const TEMPLATE_FOLDER_PATH = path.join('force-app', 'main', 'default', 'waveTemplates', 'sat1');

const expectedFiles = [
  'dashboards',
  'app-to-template-rules.json',
  'folder.json',
  'releaseNotes.html',
  'template-info.json',
  'template-to-app-rules.json',
  'ui.json',
  'variables.json'
];

test.beforeAll(async ({ baseDir }) => {
  await createProject(baseDir);
});

test('create Sample Analytics Template', async ({ workbox, evaluateInVSCode, baseDir }) => {
  await workbox.waitForTimeout(500);
  await evaluateInVSCode(async vscode => {
    await vscode.commands.executeCommand('workbench.action.showCommands');
  });

  await test.step('choose command', async () => {
    await workbox
      .getByRole('textbox', { name: 'Type the name of a command to' })
      .fill('>SFDX: Create Sample Analytics Template');
    await workbox.getByRole('textbox', { name: 'Type the name of a command to' }).press('Enter');
  });

  await test.step('enter template name', async () => {
    await workbox.getByRole('textbox', { name: 'input' }).fill('sat1');
    await workbox.getByRole('textbox', { name: 'input' }).press('Enter');
  });

  await test.step('choose directory', async () => {
    await workbox
      .getByRole('option', { name: path.join('force-app', 'main', 'default', 'waveTemplates') })
      .locator('a')
      .click();
  });

  await test.step('verify notification', async () => {
    const toast = workbox.locator('.notification-toast', {
      hasText: 'Create Sample Analytics Template successfully ran'
    });
    await workbox.screenshot({ path: path.join(baseDir, 'analytics_template_created.png') });
    await expect(toast.locator('.notification-list-item-icon')).toHaveClass(/codicon-info/);
  });

  for (const file of expectedFiles) {
    await test.step(`verify ${file} exists`, async () => {
      const filePath = path.resolve(path.join(baseDir, TEMPLATE_FOLDER_PATH, file));
      const exists = fs.existsSync(filePath);
      assert.strictEqual(exists, true, `${file} should exist`);
    });
  }

  const fileContentChecks = [
    ['app-to-template-rules.json', analyticsTemplate.appToTemplateRules],
    ['folder.json', analyticsTemplate.folder],
    ['releaseNotes.html', analyticsTemplate.releaseNotes],
    ['template-info.json', analyticsTemplate.templateInfo],
    ['template-to-app-rules.json', analyticsTemplate.templateToAppRules],
    ['ui.json', analyticsTemplate.ui],
    ['variables.json', analyticsTemplate.variables]
  ];

  for (const [file, expectedContent] of fileContentChecks) {
    await test.step(`verify ${file} content`, async () => {
      const [openFileText] = await evaluateInVSCode(
        (vscode, filePathArg) => vscode.workspace.openTextDocument(filePathArg).then(doc => [doc.getText()]),
        path.resolve(path.join(baseDir, TEMPLATE_FOLDER_PATH, file))
      );
      assert.strictEqual(openFileText.trimEnd().replace(/\r\n/g, '\n'), expectedContent);
    });
  }
});
