/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test as webTest } from '@playwright/test';
import { createDesktopTest } from '../../../src/fixtures/createDesktopTest';
import { openCommandPalette } from '../../../src/pages/commands';
import { saveScreenshot } from '../../../src/shared/screenshotUtils';
import { startVideoRecording } from '../../../src/shared/videoUtils';
import { closeWelcomeTabs, waitForVSCodeWorkbench } from '../../../src/utils/helpers';
import { activeQuickInputTextField } from '../../../src/utils/quickInput';

const test =
  process.env.VSCODE_DESKTOP === '1'
    ? createDesktopTest({ fixturesDir: `${__dirname}/../fixtures`, recordVideo: false })
    : webTest;

test.use({ video: 'off' });

test('finalizes passing and failing recordings before page teardown and permits explicit screenshots', async ({
  page
}, testInfo) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);

  const stopRecording = await startVideoRecording(page, testInfo);
  try {
    await openCommandPalette(page);
    await expect(activeQuickInputTextField(page), 'Recording should capture the open command palette').toBeVisible();
    const screenshotPath = await saveScreenshot(page, 'explicit-recording.png');
    await testInfo.attach('Explicit screenshot', { path: screenshotPath, contentType: 'image/png' });
  } finally {
    await stopRecording();
  }

  await expect(async () => {
    const stopFailedRecording = await startVideoRecording(page, testInfo, 'failed-flow');
    try {
      await page.keyboard.press('Escape');
      await expect(
        activeQuickInputTextField(page),
        'Failing recording should capture the closed palette'
      ).not.toBeVisible();
      throw new Error('Test body failed');
    } finally {
      await stopFailedRecording();
    }
  }).rejects.toThrow('Test body failed');

  expect(page.isClosed(), 'Videos should finalize before the page closes').toBe(false);
  expect(testInfo.attachments, 'Both videos and the explicit screenshot should be attached').toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'flow', contentType: 'video/webm', path: expect.stringContaining('.webm') }),
      expect.objectContaining({
        name: 'failed-flow',
        contentType: 'video/webm',
        path: expect.stringContaining('.webm')
      }),
      expect.objectContaining({
        name: 'Explicit screenshot',
        contentType: 'image/png',
        path: expect.stringContaining('.png')
      })
    ])
  );
});
