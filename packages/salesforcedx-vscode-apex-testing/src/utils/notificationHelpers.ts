/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
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
  showSuccessfulExecution: async (executionName: string, channelService: { show: () => Promise<void> }): Promise<void> => {
    void vscode.window.showInformationMessage(nls.localize('apex_test_successful_execution_message', executionName));
    await channelService.show();
  },
  showFailedExecution: (executionName: string): void => {
    void vscode.window.showErrorMessage(nls.localize('apex_test_failed_execution_message', executionName));
  }
};
