/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { Mock as VitestMock } from 'vitest';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { messages } from '../../../src/messages/i18n';
import { showRunOutcomeNotification } from '../../../src/utils/notificationHelpers';

const showSuccessNotification = vi.fn((..._a: unknown[]) => Effect.void);
const showErrorWithActions = vi.fn((..._a: unknown[]) => Effect.void);
const ExtProviderLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed({
    services: { NotificationModeService: Effect.succeed({ showSuccessNotification, showErrorWithActions }) }
  })
} as unknown as ExtensionProviderService);
const reportUri = URI.file('/tmp/test-result-RID.md');
const resultWith = (outcome: string, failing = 0) =>
  ({ tests: [], summary: { outcome, failing } }) as unknown as TestResult;

// The notification-mode and FS services are yielded from the mocked services API (ExtProviderLayer), not
// the Effect context, so erase their requirements at the boundary.
const notify = (result: TestResult | undefined, { uri = reportUri }: { uri?: URI | null } = {}) =>
  Effect.runPromise(
    Effect.provide(
      showRunOutcomeNotification(
        messages.apex_test_run_text,
        'SFDX: Run Apex Tests',
        result,
        uri ?? undefined,
        'markdown'
      ) as Effect.Effect<void, unknown, ExtensionProviderService>,
      ExtProviderLayer
    )
  );

/** The actions passed to the most recent showErrorWithActions call. */
const errorActions = () => showErrorWithActions.mock.lastCall?.[1] as { label: string; run: () => unknown }[];

describe('showRunOutcomeNotification', () => {
  const showErrorMessage = vscode.window.showErrorMessage as VitestMock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the success notification when the run passed', async () => {
    await notify(resultWith('Passed'));
    expect(showSuccessNotification).toHaveBeenCalledTimes(1);
    expect(showErrorWithActions).not.toHaveBeenCalled();
  });

  it('shows a failing-tests error with an Open Report action when tests failed', async () => {
    await notify(resultWith('Failed', 3));
    expect(showSuccessNotification).not.toHaveBeenCalled();
    expect(showErrorWithActions).toHaveBeenCalledWith(
      'SFDX: Run Apex Tests completed with 3 failing test(s). Check the output for details.',
      [{ label: 'Open Report', run: expect.any(Function) }]
    );
  });

  it('opens the report from the Open Report action on the failing-tests error', async () => {
    (vscode.commands.executeCommand as VitestMock).mockResolvedValue(undefined);
    await notify(resultWith('Failed', 1));
    await errorActions()[0].run();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', reportUri);
  });

  it('omits the Open Report action when no report was generated', async () => {
    await notify(resultWith('Failed', 1), { uri: null });
    expect(showErrorWithActions).toHaveBeenCalledWith(
      'SFDX: Run Apex Tests completed with 1 failing test(s). Check the output for details.',
      []
    );
  });

  it('shows the failed-to-run error when the run produced no result', async () => {
    await notify(undefined);
    expect(showSuccessNotification).not.toHaveBeenCalled();
    expect(showErrorWithActions).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith('SFDX: Run Apex Tests failed to run');
  });
});
