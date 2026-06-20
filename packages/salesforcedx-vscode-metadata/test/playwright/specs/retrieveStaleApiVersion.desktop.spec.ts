/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { desktopTest as test } from '../fixtures/desktopFixtures';
import { expect, type Page } from '@playwright/test';
import {
  createApexClass,
  openFileByName,
  executeCommandWithCommandPalette,
  activeQuickInputWidget,
  activeQuickInputTextField,
  EDITOR,
  isDesktop,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { RETRIEVE_TIMEOUT } from '../../constants';

// Desktop-only: edits sfdx-project.json on disk and reads the generated manifest with Node fs.
// Registers as skipped in web runs (the desktop fixture launches Electron, unavailable on web).
const desktopOnlyTest = isDesktop() ? test : test.skip.bind(test);

const WARM_API_VERSION = '64.0'; // matches the fixture's default sourceApiVersion
const EDITED_API_VERSION = '62.0';

const versionFromManifest = (xml: string): string | undefined => /<version>(.+?)<\/version>/.exec(xml)?.[1];

/** Generate a manifest from the active editor (an Apex class) into `manifest/<fileName>` and return its on-disk path. */
const generateManifest = async (page: Page, workspaceDir: string, fileName: string) => {
  await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

  const quickInput = activeQuickInputWidget(page);
  await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
  await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

  // Replace the default `package.xml` value with a per-call name so the second run does not hit the overwrite modal.
  // `fill` clears and sets atomically; `Control+a` is move-to-line-start (readline) on macOS, not select-all,
  // which left the default in place and produced e.g. `pkgWarmpackage.xml` instead of `pkgWarm.xml`.
  await activeQuickInputTextField(page).fill(fileName.replace(/\.xml$/i, ''));
  await page.keyboard.press('Enter');

  const manifestPath = path.join(workspaceDir, 'manifest', fileName);
  const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${fileName}"]`).first();
  await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
  return manifestPath;
};

/** Poll the workspace sfdx-project.json until the write is readable, with exponential backoff and a deadline. */
const waitForProjectApiVersionOnDisk = async (workspaceDir: string, version: string) => {
  const file = path.join(workspaceDir, 'sfdx-project.json');
  const deadline = Date.now() + 15_000;
  let delay = 50;
  while (Date.now() < deadline) {
    const project = JSON.parse(await fs.readFile(file, 'utf8'));
    if (project.sourceApiVersion === version) return;
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 1000);
  }
  throw new Error(`sfdx-project.json sourceApiVersion never became ${version}`);
};

desktopOnlyTest(
  'manifest version tracks mid-session sourceApiVersion edit without reload',
  async ({ page, workspaceDir }) => {
    test.setTimeout(RETRIEVE_TIMEOUT);
    const className = `StaleApiVersion${Date.now()}`;

    await test.step('create apex class', async () => {
      await createApexClass(page, className);
      await saveScreenshot(page, 'stale-api.after-create-class.png');
    });

    await test.step('warm the SfProject cache (sourceApiVersion=64.0)', async () => {
      const warmManifestPath = await generateManifest(page, workspaceDir, 'pkgWarm.xml');
      const warmXml = await fs.readFile(warmManifestPath, 'utf8');
      // Baseline: the warmed manifest reflects the original disk value, proving the cache held 64.0.
      expect(versionFromManifest(warmXml), 'warmed manifest version').toBe(WARM_API_VERSION);
    });

    await test.step('edit sfdx-project.json sourceApiVersion 64.0 -> 62.0 on disk', async () => {
      const file = path.join(workspaceDir, 'sfdx-project.json');
      const project = JSON.parse(await fs.readFile(file, 'utf8'));
      project.sourceApiVersion = EDITED_API_VERSION;
      await fs.writeFile(file, JSON.stringify(project, null, 2));
      // The poll only confirms the test's own write is readable; the VS Code FileSystemWatcher ->
      // FileChangePubSub -> 5ms debounce -> invalidateSfProjectCache pipeline is async and OS-latency
      // dependent. Add a fixed settle delay so invalidation completes before the next manifest build.
      await waitForProjectApiVersionOnDisk(workspaceDir, EDITED_API_VERSION);
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    await test.step('regenerate manifest picks up the edited version (cache invalidated)', async () => {
      // Re-focus the Apex class so it is the source for the manifest (the warm run left the manifest active).
      await openFileByName(page, `${className}.cls`);
      const freshManifestPath = await generateManifest(page, workspaceDir, 'pkgFresh.xml');
      const freshXml = await fs.readFile(freshManifestPath, 'utf8');
      // The fix: a fresh SfProject is resolved, so the manifest tracks 62.0 instead of the stale 64.0.
      expect(versionFromManifest(freshXml), 'fresh manifest version after edit').toBe(EDITED_API_VERSION);
    });
  }
);
