/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProgressAndSuccessCommandKey } from './notificationMode';
import type { OutputFormat } from '@salesforce/apex-node';
import type { Context } from 'effect';
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

/**
 * Shared success toast for the run-tests flows: a single combined message (plus an "Open Report"
 * action when report generation succeeded). `openReport` is injected rather than imported so this
 * stays usable from apexTestExecutionService.ts, which resolves its own runtime to avoid a circular
 * import through services/extensionProvider.ts.
 */
export const showRunSuccessNotification = (
  notificationMode: Context.Tag.Service<typeof NotificationModeService>,
  command: ProgressAndSuccessCommandKey,
  executionName: string,
  reportUri: URI | undefined,
  outputFormat: OutputFormat,
  openReport: (reportUri: URI, outputFormat: OutputFormat) => void | Promise<void>
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
