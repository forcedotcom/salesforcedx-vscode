/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  readAllSpanRows,
  reloadWindow,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForSpanRows,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady,
  type SpanRow
} from '@salesforce/playwright-vscode-ext';
import { desktopJestTest as test } from '../fixtures/desktopFixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

const nowNanos = (): bigint => BigInt(Date.now()) * 1_000_000n;
const spansSince = (baselineNanos: bigint) => async (): Promise<SpanRow[]> =>
  (await readAllSpanRows()).filter(row => row.kind === 'span' && BigInt(row.startTimeUnixNano ?? '0') > baselineNanos);
const hasTelemetryAttributes = (span: SpanRow): boolean =>
  span.attributes?.workspaceType === 'SFDX' && typeof span.attributes.executionTime === 'number';

const continueDebuggingUntilDone = async (page: Page): Promise<void> => {
  const debugToolbar = page.locator('.debug-toolbar');
  await debugToolbar.waitFor({ state: 'visible', timeout: 30_000 });
  const continueButton = debugToolbar.getByRole('button', { name: /Continue/i }).first();
  await expect(async () => {
    if (await debugToolbar.isVisible({ timeout: 500 }).catch(() => false)) {
      await continueButton.click({ timeout: 5000 });
      throw new Error('debug session still active');
    }
  }).toPass({ timeout: 3 * 60 * 1000 });
};

test('LWC run, debug, and deactivation emit Effect spans', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const sessionStarted = nowNanos();
  const readSessionSpans = spansSince(sessionStarted);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await waitForWorkspaceReady(page);

  await test.step('create and open an LWC Jest test', async () => {
    await createLwc(page, 'lwcTelemetry');
    await openLwcFile(page, 'lwcTelemetry.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'lwcTelemetry.test.js');
  });

  await test.step('run emits lwc_test_run_action with telemetry attributes', async () => {
    await executeCommandWithCommandPalette(page, 'SFDX: Run Current Lightning Web Component Test File');
    const rows = await waitForSpanRows(
      readSessionSpans,
      spans => spans.some(span => span.name === 'lwc_test_run_action' && hasTelemetryAttributes(span)),
      'lwc_test_run_action span with workspaceType and executionTime'
    );
    expect(rows.some(span => span.name === 'lwc_test_run_action' && hasTelemetryAttributes(span))).toBe(true);
  });

  await test.step('debug emits lwc_test_debug_action with telemetry attributes', async () => {
    await executeCommandWithCommandPalette(page, 'SFDX: Debug Current Lightning Web Component Test File');
    await continueDebuggingUntilDone(page);
    const rows = await waitForSpanRows(
      readSessionSpans,
      spans => spans.some(span => span.name === 'lwc_test_debug_action' && hasTelemetryAttributes(span)),
      'lwc_test_debug_action span with workspaceType and executionTime'
    );
    expect(rows.some(span => span.name === 'lwc_test_debug_action' && hasTelemetryAttributes(span))).toBe(true);
  });

  await test.step('reload emits extensionDeactivated', async () => {
    await reloadWindow(page);
    const rows = await waitForSpanRows(
      readSessionSpans,
      spans => spans.some(span => span.name === 'extensionDeactivated'),
      'extensionDeactivated span'
    );
    expect(rows.some(span => span.name === 'extensionDeactivated')).toBe(true);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
