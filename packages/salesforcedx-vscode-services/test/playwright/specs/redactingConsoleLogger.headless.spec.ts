/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { executeCommandById, startVideoRecording, waitForVSCodeWorkbench } from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';

test('redacts Effect logs emitted through the services runtime', async ({ page }, testInfo) => {
  const consoleLogs: string[] = [];
  page.on('console', message => consoleLogs.push(message.text()));
  await waitForVSCodeWorkbench(page);

  const videoName = [testInfo.project.name, ...testInfo.titlePath, 'redact-logs', `retry-${testInfo.retry}`]
    .join('-')
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  const stopRecording = await startVideoRecording(page, testInfo, videoName);
  try {
    await executeCommandById(page, 'sf.internal.testRedactingConsoleLogger', {
      verifyExecution: async () => {
        expect(consoleLogs.join('\n')).toContain('<REDACTED ACCESS TOKEN>');
      }
    });

    expect(consoleLogs.join('\n')).not.toContain('playwright-secret');
  } finally {
    await stopRecording();
  }
});
