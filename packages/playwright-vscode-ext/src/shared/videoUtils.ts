/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page, type TestInfo } from '@playwright/test';

/** Start after setup; the returned function finalizes and attaches the video before page/Electron teardown. */
export const startVideoRecording = async (
  page: Page,
  testInfo: TestInfo,
  name = 'flow'
): Promise<() => Promise<void>> => {
  const videoPath = testInfo.outputPath(`${name}.webm`);
  let hasRecordedFrame = false;
  await page.screencast.start({
    path: videoPath,
    size: { width: 1920, height: 1080 },
    onFrame: () => {
      hasRecordedFrame = true;
      return Promise.resolve();
    }
  });
  return async () => {
    // Short flows can finish before Chromium delivers the first frame to the recorder.
    await expect
      .poll(() => hasRecordedFrame, { message: 'Video should receive a frame before finalization', timeout: 10_000 })
      .toBe(true);
    await page.screencast.stop();
    await testInfo.attach(name, { path: videoPath, contentType: 'video/webm' });
  };
};
