/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  readAllSpanRows,
  reloadWindow,
  waitForSpanRows,
  waitForVSCodeWorkbench,
  type SpanRow
} from '@salesforce/playwright-vscode-ext';
import { telemetryDesktopTest as test } from '../fixtures/desktopFixtures';

type CoreSpanRow = SpanRow & { status?: { code?: number; message?: string } };
const TELEMETRY_TAG = 'core-telemetry-e2e-test';
const readCoreSpans = async (): Promise<CoreSpanRow[]> =>
  (await readAllSpanRows()).filter(row => row.kind === 'span' && row.attributes?.telemetryTag === TELEMETRY_TAG);
const findSpan = (rows: CoreSpanRow[], name: string): CoreSpanRow | undefined => rows.find(row => row.name === name);

test('startup refresh and deactivation emit exported telemetry spans', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForVSCodeWorkbench(page);

  await test.step('startup refresh span is exported', async () => {
    const rows = await waitForSpanRows(
      readCoreSpans,
      spans => findSpan(spans, 'sObjectRefreshNotification') !== undefined,
      'sObjectRefreshNotification span'
    );
    expect(findSpan(rows, 'sObjectRefreshNotification')).toEqual(
      expect.objectContaining({
        parentSpanId: '',
        status: { code: 1, message: '' },
        attributes: expect.objectContaining({ type: 'startupmin', telemetryTag: TELEMETRY_TAG })
      })
    );
  });

  await test.step('deactivation span is exported', async () => {
    await reloadWindow(page);
    const rows = await waitForSpanRows(
      readCoreSpans,
      spans => findSpan(spans, 'deactivationEvent') !== undefined,
      'deactivationEvent span'
    );
    expect(findSpan(rows, 'deactivationEvent')).toEqual(
      expect.objectContaining({
        parentSpanId: '',
        status: { code: 1, message: '' },
        attributes: expect.objectContaining({
          extensionName: 'salesforcedx-vscode-core',
          telemetryTag: TELEMETRY_TAG
        })
      })
    );
  });
});
