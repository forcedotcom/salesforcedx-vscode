/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  executeCommandWithCommandPalette,
  isDesktop,
  prepareNoFolderOpenForPaletteTests,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  verifyCommandExists,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { emptyWorkspaceDesktopTest as test } from '../fixtures';

// End-to-end proof that the beta.43 Azure exporter divert wire is intact: in Development/Test extension
// mode the SDK swaps its private `sender` for the local one (spansNode.ts) so Breeze envelopes POST to the
// span file server's /v2.1/track handler, which writes them to ~/.sf/vscode-appinsights/appinsights-*.jsonl.
// A top-level command span (SpanKind.INTERNAL, no telemetryIgnore) maps to a RemoteDependencyData envelope
// (Azure spanUtils.readableSpanToEnvelope). If beta.43 had renamed the private `sender` field, the
// ts-expect-error override in spansNode.ts would no-op, envelopes would go to Azure (unreachable https),
// and this file would never appear — the poll below then times out and fails loudly.
const APP_INSIGHTS_DIR = path.join(os.homedir(), '.sf', 'vscode-appinsights');

type Envelope = { data?: { baseType?: string } };

// Node Breeze envelopes land in appinsights-*.jsonl (web events go to appinsights-web-*; see spanFileServer).
// The dir is shared across runs; target the newest matching file, same as the vscode-spans specs.
const newestAppInsightsFile = async (): Promise<string | undefined> => {
  const entries = await fs.readdir(APP_INSIGHTS_DIR).catch(() => [] as string[]);
  return entries
    .filter(name => name.startsWith('appinsights-') && !name.startsWith('appinsights-web-') && name.endsWith('.jsonl'))
    .toSorted()
    .toReversed()[0];
};

const readEnvelopes = async (file: string): Promise<Envelope[]> => {
  const contents = await fs.readFile(path.join(APP_INSIGHTS_DIR, file), 'utf-8').catch(() => '');
  return contents
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Envelope);
};

class EnvelopeNotReadyError extends Data.TaggedError('EnvelopeNotReadyError')<{ readonly message: string }> {}

// Poll the appinsights dir until an appinsights-*.jsonl exists whose envelopes satisfy `predicate`.
// The file itself is created lazily on the first POST, so re-resolve newestAppInsightsFile each tick.
const waitForEnvelopes = (predicate: (envelopes: Envelope[]) => boolean, message: string): Promise<Envelope[]> =>
  Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const file = await newestAppInsightsFile();
        const envelopes = file ? await readEnvelopes(file) : [];
        if (!predicate(envelopes)) throw new EnvelopeNotReadyError({ message });
        return envelopes;
      },
      catch: () => new EnvelopeNotReadyError({ message })
    }).pipe(Effect.retry(Schedule.spaced(Duration.seconds(1))), Effect.timeout(Duration.seconds(90)))
  );

(isDesktop() ? test : test.skip.bind(test))(
  'Azure exporter divert: a command span reaches ~/.sf/vscode-appinsights as a RemoteDependencyData envelope',
  async ({ page, workspaceDir }) => {
    test.setTimeout(180_000);

    const targetDir = path.dirname(workspaceDir);
    const projectName = `AzureDivert${Date.now()}`;

    await test.step('close workspace to reach empty state', async () => {
      await prepareNoFolderOpenForPaletteTests(page);
    });

    await test.step('drive Create Project (yields a top-level sf.project.generate command span)', async () => {
      await verifyCommandExists(page, packageNls.project_generate_text, 120_000);
      await executeCommandWithCommandPalette(page, packageNls.project_generate_text);
      await waitForQuickInputFirstOption(page, {
        quickInputVisibleTimeout: 30_000,
        optionVisibleTimeout: 15_000,
        retryTimeout: 60_000
      });

      const standardRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: /Standard/ });
      await standardRow.waitFor({ state: 'visible', timeout: 20_000 });
      await standardRow.click();

      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(projectName);
      await page.keyboard.press('Enter');

      const folderInput = quickInput.locator('input.input');
      await folderInput.fill(`${targetDir}${path.sep}`);
      await expect(quickInput.getByText('path does not exist')).not.toBeVisible({ timeout: 5000 });
      await quickInput.getByRole('button', { name: 'Create Project' }).click();
    });

    await test.step('project generated on disk (command span has ended and flushed)', async () => {
      await expect(async () => {
        await fs.access(path.join(targetDir, projectName, 'sfdx-project.json'));
      }).toPass({ timeout: 120_000 });
    });

    await test.step('a RemoteDependencyData Breeze envelope reached the local /v2.1/track sink', async () => {
      const envelopes = await waitForEnvelopes(
        list => list.some(e => e.data?.baseType === 'RemoteDependencyData'),
        'RemoteDependencyData envelope in appinsights-*.jsonl'
      );
      expect(envelopes.some(e => e.data?.baseType === 'RemoteDependencyData')).toBe(true);
      await saveScreenshot(page, 'azureExporterDivert.verified.png');
    });
  }
);
