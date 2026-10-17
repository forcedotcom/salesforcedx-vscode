/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProgressAndSuccessCommandKey } from './notificationMode';
import type { OutputFormat, TestResult } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { openTestReport } from './testReportGenerator';

/**
 * Simple notification service wrapper that uses vscode.window directly.
 * Replaces notificationService from @salesforce/salesforcedx-utils-vscode
 */
export const notificationService = {
  showInformationMessage: (message: string, ...items: string[]): Thenable<string | undefined> =>
    vscode.window.showInformationMessage(message, ...items),
  showWarningMessage: (message: string, ...items: string[]): Thenable<string | undefined> =>
    vscode.window.showWarningMessage(message, ...items),
  showErrorMessage: (message: string, ...items: string[]): Thenable<string | undefined> =>
    vscode.window.showErrorMessage(message, ...items),
  showFailedExecution: (executionName: string): void => {
    void vscode.window.showErrorMessage(nls.localize('apex_test_failed_execution_message', executionName));
  }
};

/**
 * Terminal toast for the run-tests flows, keyed on the run's outcome: success when tests passed, a
 * "completed with failing tests" error when some failed, and `showFailedExecution` when the run produced
 * no usable result (timeout / no summary) or ended in any other state. Both toasts get an "Open Report"
 * action when report generation succeeded. The action runs on the caller's runtime, captured here, so this
 * needs no import of services/extensionProvider.ts, which apexTestExecutionService.ts can't import without a
 * cycle.
 */
export const showRunOutcomeNotification = Effect.fn('ApexTesting.showRunOutcomeNotification')(function* (
  command: ProgressAndSuccessCommandKey,
  executionName: string,
  result: TestResult | undefined,
  reportUri: URI | undefined,
  outputFormat: OutputFormat
) {
  const notificationMode = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services
    .NotificationModeService;
  const runtime = yield* Effect.runtime<Effect.Effect.Context<ReturnType<typeof openTestReport>>>();
  const openReportActions = reportUri
    ? [
        {
          label: nls.localize('apex_test_report_open_action'),
          run: () => Runtime.runPromise(runtime)(openTestReport(reportUri, outputFormat))
        }
      ]
    : [];

  yield* Match.value(result).pipe(
    Match.when({ summary: { outcome: 'Passed' } }, () =>
      notificationMode.showSuccessNotification(
        command,
        reportUri
          ? nls.localize('apex_test_successful_execution_with_report_message', executionName, Utils.basename(reportUri))
          : nls.localize('apex_test_successful_execution_message', executionName),
        false,
        openReportActions
      )
    ),
    Match.when({ summary: { outcome: 'Failed' } }, failed =>
      notificationMode.showErrorWithActions(
        nls.localize('apex_test_completed_with_failures_message', executionName, failed.summary.failing),
        openReportActions
      )
    ),
    Match.orElse(() => Effect.sync(() => notificationService.showFailedExecution(executionName)))
  );
});
