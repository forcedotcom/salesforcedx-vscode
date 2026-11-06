/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test as webTest } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { desktopTest } from './desktopFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

// Keep the browser open on failure when debugging web runs.
webTest.afterEach(async ({ page }, testInfo) => {
  if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
    await page.pause();
  }
});

// `.headless.spec.ts` files run on both configs; the desktop config sets VSCODE_DESKTOP, web does not.
const platformTest = isDesktop ? desktopTest : webTest;

export const test = platformTest.extend<{ waitForVideoFrame: () => Promise<void> }>({
  waitForVideoFrame: [
    async ({ page }, use, testInfo) => {
      setupConsoleMonitoring(page);
      setupNetworkMonitoring(page);
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await waitForWorkspaceReady(page);

      const videoPath = testInfo.outputPath('visualforce-flow.webm');
      let lastFrameTimestamp = 0;
      const waitForVideoFrame = async () => {
        const assertedAt = Date.now();
        // DOM assertions can finish before Chromium presents the frame. Keep the asserted UI
        // on screen until the recorder receives a newly presented frame, without a fixed delay.
        await expect
          .poll(() => lastFrameTimestamp, { message: 'Video should capture the asserted UI', timeout: 10_000 })
          .toBeGreaterThanOrEqual(assertedAt);
      };
      await page.screencast.start({
        path: videoPath,
        size: { width: 1920, height: 1080 },
        onFrame: ({ timestamp }) => {
          lastFrameTimestamp = timestamp;
          return Promise.resolve();
        }
      });
      try {
        await use(waitForVideoFrame);
        await waitForVideoFrame();
      } finally {
        // Finalize before Electron teardown can kill the process; retain passing and failing flows.
        await page.screencast.stop();
        await testInfo.attach('Visualforce flow', { path: videoPath, contentType: 'video/webm' });
      }
    },
    { auto: true }
  ]
});
