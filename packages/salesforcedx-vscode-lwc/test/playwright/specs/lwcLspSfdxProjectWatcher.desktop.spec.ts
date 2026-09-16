/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  clearOutputChannel,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  selectOutputChannel,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from '@playwright/test';
import { desktopTest as test } from '../fixtures/desktopFixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP restarts when sfdx-project.json packageDirectories change', async ({ page, workspaceDir }) => {
  test.setTimeout(5 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const sfdxProjectPath = path.join(workspaceDir, 'sfdx-project.json');

  await test.step('create initial Lightning Web Component in force-app', async () => {
    await createLwc(page, 'initialComp');
  });

  await test.step('open LWC HTML file to activate language status item', async () => {
    await openLwcFile(page, 'initialComp.html');
  });

  await test.step('wait for LWC LSP to finish initial indexing', async () => {
    await waitForLwcLspReady(page);
  });

  await test.step('read initial sfdx-project.json', async () => {
    const sfdxProjectContent = await fs.readFile(sfdxProjectPath, 'utf-8');
    const sfdxProject = JSON.parse(sfdxProjectContent) as {
      packageDirectories?: Array<{ path: string; default?: boolean }>;
    };
    expect(sfdxProject.packageDirectories).toBeDefined();
    expect(Array.isArray(sfdxProject.packageDirectories)).toBe(true);
  });

  await test.step('modify sfdx-project.json to add a new package directory', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Lightning Web Components');
    await clearOutputChannel(page);

    // Read current sfdx-project.json
    const sfdxProjectContent = await fs.readFile(sfdxProjectPath, 'utf-8');
    const sfdxProject = JSON.parse(sfdxProjectContent) as {
      packageDirectories?: Array<{ path: string; default?: boolean }>;
    };

    // Create new package directory structure
    const newPkgDir = 'utils';
    await fs.mkdir(path.join(workspaceDir, newPkgDir, 'main', 'default', 'lwc'), { recursive: true });

    // Add new package directory to sfdx-project.json
    sfdxProject.packageDirectories ??= [];
    sfdxProject.packageDirectories.push({
      path: newPkgDir,
      default: false
    });

    // Write updated sfdx-project.json
    await fs.writeFile(sfdxProjectPath, JSON.stringify(sfdxProject, null, 2), 'utf-8');
  });

  await test.step('wait for language server to detect change and restart', async () => {
    await waitForOutputChannelText(page, {
      expectedText: 'Restarting LWC Language Server due to sfdx-project.json changes...',
      timeout: 30_000
    });
    await waitForOutputChannelText(page, {
      expectedText: 'LWC Language Server restarted successfully',
      timeout: 90_000
    });
  });

  await test.step('create LWC in the new package directory and verify it is indexed', async () => {
    // Create a component in the new package directory
    const newCompPath = path.join(workspaceDir, 'utils', 'main', 'default', 'lwc', 'utilsComp');
    await fs.mkdir(newCompPath, { recursive: true });

    await fs.writeFile(
      path.join(newCompPath, 'utilsComp.js'),
      `import { LightningElement } from 'lwc';
export default class UtilsComp extends LightningElement {}`,
      'utf-8'
    );

    await fs.writeFile(
      path.join(newCompPath, 'utilsComp.html'),
      `<template>
  <div>Utils Component</div>
</template>`,
      'utf-8'
    );

    await fs.writeFile(
      path.join(newCompPath, 'utilsComp.js-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>62.0</apiVersion>
  <isExposed>false</isExposed>
</LightningComponentBundle>`,
      'utf-8'
    );

    const customComponentsIndex = path.join(workspaceDir, '.sfdx', 'indexes', 'lwc', 'custom-components.json');
    await expect
      .poll(() => fs.readFile(customComponentsIndex, 'utf-8').catch(() => ''), {
        timeout: 90_000,
        message: 'LWC language server should index utilsComp from the new package directory'
      })
      .toContain('utilsComp');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
