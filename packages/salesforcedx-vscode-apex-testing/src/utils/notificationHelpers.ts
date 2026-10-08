/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProgressAndSuccessCommandKey } from './notificationMode';
import type { OutputFormat, TestResult } from '@salesforce/apex-node';
import type { Context } from 'effect';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import type { NotificationModeService } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

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

type OpenReport = (reportUri: URI, outputFormat: OutputFormat) => void | Promise<void>;

/** Success toast: a combined message plus an "Open Report" action when report generation succeeded. */
const showRunSuccessNotification = (
  notificationMode: Context.Tag.Service<typeof NotificationModeService>,
  command: ProgressAndSuccessCommandKey,
  executionName: string,
  reportUri: URI | undefined,
  outputFormat: OutputFormat,
  openReport: OpenReport
) =>
  notificationMode.showSuccessNotification(
    command,
    reportUri
      ? nls.localize('apex_test_successful_execution_with_report_message', executionName, Utils.basename(reportUri))
      : nls.localize('apex_test_successful_execution_message', executionName),
    false,
    reportUri
      ? [
          {
            label: nls.localize('apex_test_report_open_action'),
            run: () => openReport(reportUri, outputFormat)
          }
        ]
      : []
  );

/** Error toast for a run that completed with failing tests, plus an "Open Report" action when report
 * generation succeeded. Fire-and-forget: the click is handled without blocking the run. */
const showTestFailuresNotification = (
  executionName: string,
  failing: number,
  reportUri: URI | undefined,
  outputFormat: OutputFormat,
  openReport: OpenReport
): void => {
  const openReportLabel = nls.localize('apex_test_report_open_action');
  void vscode.window
    .showErrorMessage(
      nls.localize('apex_test_completed_with_failures_message', executionName, failing),
      ...(reportUri ? [openReportLabel] : [])
    )
    .then(choice => (reportUri && choice === openReportLabel ? openReport(reportUri, outputFormat) : undefined));
};

/**
 * Terminal toast for the run-tests flows, keyed on the run's outcome: success when tests passed, a
 * "completed with failing tests" error when some failed, and `showFailedExecution` when the run produced
 * no usable result (timeout / no summary) or ended in any other state. `openReport` is injected rather
 * than imported so this stays usable from apexTestExecutionService.ts, which resolves its own runtime to
 * avoid a circular import through services/extensionProvider.ts.
 */
export const showRunOutcomeNotification = (
  notificationMode: Context.Tag.Service<typeof NotificationModeService>,
  command: ProgressAndSuccessCommandKey,
  executionName: string,
  result: TestResult | undefined,
  reportUri: URI | undefined,
  outputFormat: OutputFormat,
  openReport: OpenReport
) =>
  Match.value(result).pipe(
    Match.when({ summary: { outcome: 'Passed' } }, () =>
      showRunSuccessNotification(notificationMode, command, executionName, reportUri, outputFormat, openReport)
    ),
    Match.when({ summary: { outcome: 'Failed' } }, failed =>
      Effect.sync(() =>
        showTestFailuresNotification(executionName, failed.summary.failing, reportUri, outputFormat, openReport)
      )
    ),
    Match.orElse(() => Effect.sync(() => notificationService.showFailedExecution(executionName)))
  );
