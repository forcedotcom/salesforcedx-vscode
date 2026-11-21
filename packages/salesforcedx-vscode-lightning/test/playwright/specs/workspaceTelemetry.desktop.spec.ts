/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  executeCommandWithCommandPalette,
  openFileByName,
  parseJsonlLines,
  QUICK_INPUT_WIDGET,
  readJsonlFiles,
  SPANS_DIR,
  type SpanRow,
  waitForQuickInputFirstOption,
  waitForSpanRows
} from '@salesforce/playwright-vscode-ext';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { workspaceTelemetryTest as test, WORKSPACE_TELEMETRY_TAG } from '../fixtures/workspaceTelemetryFixtures';
import { waitForAuraLspReady } from '../utils/auraLspUtils';

type AppInsightsEnvelope = {
  data?: { baseData?: { name?: string; properties?: Record<string, unknown> } };
};
type O11yEvent = { name?: string; properties?: Record<string, unknown> };

const APPINSIGHTS_DIR = path.join(os.homedir(), '.sf', 'vscode-appinsights');
const O11Y_DIR = path.join(os.homedir(), '.sf', 'vscode-o11y');
const COMMAND = 'sf.lightning.generate.aura.component';
const CAPTURE_SINCE = Date.now();
const readLocalSpans = async () => parseJsonlLines<SpanRow>(await readJsonlFiles(SPANS_DIR, CAPTURE_SINCE));
const readAppInsightsEvents = async () =>
  parseJsonlLines<AppInsightsEnvelope>(await readJsonlFiles(APPINSIGHTS_DIR, CAPTURE_SINCE))
    .map(envelope => envelope.data?.baseData)
    .filter(event => event?.properties?.telemetryTag === WORKSPACE_TELEMETRY_TAG);
const readO11yEvents = async () =>
  parseJsonlLines<O11yEvent>(await readJsonlFiles(O11Y_DIR, CAPTURE_SINCE)).filter(
    event => event.properties?.telemetryTag === WORKSPACE_TELEMETRY_TAG
  );

test('workspace handlers stay in local traces but not App Insights or O11y', async ({ page }) => {
  test.setTimeout(240_000);

  await test.step('exercise workspace handlers through Aura language-server indexing', async () => {
    await openFileByName(page, 'WorkspaceTelemetry.cmp');
    await waitForAuraLspReady(page);

    const rows = await waitForSpanRows(
      readLocalSpans,
      spans =>
        spans.some(
          span => span.name === 'WorkspaceHandler.readFile' && span.attributes?.telemetryTag === WORKSPACE_TELEMETRY_TAG
        ),
      'this session’s workspace/readFile span in local tracing'
    );
    const handlers = rows.filter(
      span => span.name?.startsWith('WorkspaceHandler.') && span.attributes?.telemetryTag === WORKSPACE_TELEMETRY_TAG
    );
    expect(handlers.length, 'real workspace requests must produce local spans').toBeGreaterThan(0);
    handlers.forEach(span => {
      expect(span.parentSpanId, `${span.name} must be parentless`).toBe('');
      expect(span.attributes?.telemetryIgnore, `${span.name} must opt out of production telemetry`).toBe(true);
    });
  });

  await test.step('export a later command as a positive control for both production exporters', async () => {
    await executeCommandWithCommandPalette(page, packageNls.lightning_generate_aura_component_text);
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible' });
    await page.keyboard.type('TelemetryExportControl');
    await page.keyboard.press('Enter');
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');
    await expect(
      page.locator(`${EDITOR_WITH_URI}[data-uri$="TelemetryExportControl.cmp"]`).first(),
      'the control command must finish creating its component'
    ).toBeVisible();

    // A later span from the same extension proves both batch exporters have processed the earlier handlers.
    await expect
      .poll(async () => (await readAppInsightsEvents()).some(event => event?.name === COMMAND), {
        timeout: 90_000,
        message: 'the command must reach the real App Insights exporter and local HTTP capture server'
      })
      .toBe(true);
    await expect
      .poll(async () => (await readO11yEvents()).some(event => event.name === COMMAND), {
        timeout: 90_000,
        message: 'the command must reach the real O11y exporter and local HTTP capture server'
      })
      .toBe(true);
  });

  await test.step('neither production payload contains workspace-handler spans', async () => {
    expect(
      (await readAppInsightsEvents()).filter(event => event?.name?.startsWith('WorkspaceHandler.')),
      'App Insights must exclude workspace-handler spans'
    ).toEqual([]);
    expect(
      (await readO11yEvents()).filter(event => event.name?.startsWith('WorkspaceHandler.')),
      'O11y must exclude workspace-handler spans'
    ).toEqual([]);
  });
});
