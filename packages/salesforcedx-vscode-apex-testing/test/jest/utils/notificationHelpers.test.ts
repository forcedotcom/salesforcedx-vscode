/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '@salesforce/apex-node';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { messages } from '../../../src/messages/i18n';
import { showRunOutcomeNotification } from '../../../src/utils/notificationHelpers';

const showSuccessNotification = jest.fn((..._a: unknown[]) => Effect.void);
const notificationMode = { showSuccessNotification } as unknown as Parameters<typeof showRunOutcomeNotification>[0];
const reportUri = URI.file('/tmp/test-result-RID.md');
const resultWith = (outcome: string, failing = 0) =>
  ({ tests: [], summary: { outcome, failing } }) as unknown as TestResult;

const notify = (
  result: TestResult | undefined,
  { openReport = jest.fn(), uri = reportUri }: { openReport?: jest.Mock; uri?: URI | null } = {}
) =>
  Effect.runPromise(
    showRunOutcomeNotification(
      notificationMode,
      messages.apex_test_run_text,
      'SFDX: Run Apex Tests',
      result,
      uri ?? undefined,
      'markdown',
      openReport
    )
  );

describe('showRunOutcomeNotification', () => {
  const showErrorMessage = vscode.window.showErrorMessage as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    showErrorMessage.mockResolvedValue(undefined);
  });

  it('shows the success notification when the run passed', async () => {
    await notify(resultWith('Passed'));
    expect(showSuccessNotification).toHaveBeenCalledTimes(1);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('shows a failing-tests error with an Open Report action when tests failed', async () => {
    await notify(resultWith('Failed', 3));
    expect(showSuccessNotification).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith(
      'SFDX: Run Apex Tests completed with 3 failing test(s). Check the output for details.',
      'Open Report'
    );
  });

  it('opens the report when Open Report is clicked on the failing-tests error', async () => {
    showErrorMessage.mockResolvedValue('Open Report');
    const openReport = jest.fn();
    await notify(resultWith('Failed', 1), { openReport });
    await new Promise(resolve => setImmediate(resolve));
    expect(openReport).toHaveBeenCalledWith(reportUri, 'markdown');
  });

  it('omits the Open Report action when no report was generated', async () => {
    await notify(resultWith('Failed', 1), { uri: null });
    expect(showErrorMessage).toHaveBeenCalledWith(
      'SFDX: Run Apex Tests completed with 1 failing test(s). Check the output for details.'
    );
  });

  it('shows the failed-to-run error when the run produced no result', async () => {
    await notify(undefined);
    expect(showSuccessNotification).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith('SFDX: Run Apex Tests failed to run');
  });
});
