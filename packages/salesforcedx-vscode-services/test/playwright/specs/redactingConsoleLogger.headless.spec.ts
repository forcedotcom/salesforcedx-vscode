/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { executeCommandById, waitForVSCodeWorkbench } from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';

test('redacts Effect logs emitted through the services runtime', async ({ page }) => {
  const consoleLogs: string[] = [];
  page.on('console', message => consoleLogs.push(message.text()));
  await waitForVSCodeWorkbench(page);

  await executeCommandById(page, 'sf.internal.testRedactingConsoleLogger', {
    verifyExecution: async () => {
      expect(consoleLogs.join('\n')).toContain('<REDACTED ACCESS TOKEN>');
    }
  });

  expect(consoleLogs.join('\n')).not.toContain('playwright-secret');
});
