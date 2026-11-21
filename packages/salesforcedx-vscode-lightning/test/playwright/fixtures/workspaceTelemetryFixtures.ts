/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  createDesktopTest,
  ensureSecondarySideBarHidden,
  startVideoRecording,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const WORKSPACE_TELEMETRY_TAG = `workspace-handler-${randomUUID()}`;

const baseTest = createDesktopTest({
  fixturesDir: __dirname,
  // Development mode diverts both production exporters to the local capture server.
  useVsix: false,
  recordVideo: false,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  disableOtherExtensions: false,
  userSettings: {
    'telemetry.telemetryLevel': 'all',
    'salesforcedx-vscode-core.telemetry.enabled': true,
    'salesforcedx-vscode-core.telemetry-tag': WORKSPACE_TELEMETRY_TAG
  }
});

export const workspaceTelemetryTest = baseTest.extend({
  workspaceDir: async ({ workspaceDir }, use) => {
    const bundleDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'aura', 'WorkspaceTelemetry');
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.writeFile(path.join(bundleDir, 'WorkspaceTelemetry.cmp'), '<aura:component/>');
    await use(workspaceDir);
  },
  page: async ({ page }, use, testInfo) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    const stopRecording = await startVideoRecording(page, testInfo);
    try {
      await use(page);
    } finally {
      await stopRecording();
    }
  }
});
