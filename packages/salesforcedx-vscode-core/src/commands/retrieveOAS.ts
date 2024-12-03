/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';

export const retrieveOAS = async (sourceUri: vscode.Uri | undefined, uris: vscode.Uri[] | undefined) => {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async progress => {
        progress.report({ message: nls.localize('progress_notification_text', nls.localize('retrieve_oas_title')) });
        if (!sourceUri) {
          // When the source is Retrieved via the command palette, sourceUri is undefined,
          // and needs to be obtained from the active text editor.
          sourceUri = getUriFromActiveEditor();
          if (!sourceUri) {
            return;
          }
        }
      }
    );

    // Notify Success
    notificationService.showInformationMessage(nls.localize('retrieve_oas_succeeded'));
    telemetryService.sendEventData('retrieve_oas_succeeded', undefined);
  } catch (error: any) {
    void handleError(error, 'retrieve_oas_failed');
  }
};

export const getUriFromActiveEditor = (): vscode.Uri | undefined => {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId === 'yaml') {
    return editor.document.uri;
  }

  const errorMessage = nls.localize('retrieve_oas_failed');
  telemetryService.sendException('retrieve_oas_failed', errorMessage);
  notificationService.showErrorMessage(errorMessage);
  channelService.appendLine(errorMessage);
  channelService.showChannelOutput();

  return undefined;
};

/**
 * Handles errors by showing a notification and sending telemetry data.
 * @param error - The error to handle.
 * @param telemetryEvent - The telemetry event name.
 */
const handleError = async (error: any, telemetryEvent: string): Promise<void> => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  notificationService.showErrorMessage(`${nls.localize('retrieve_oas_failed')}: ${errorMessage}`);
  telemetryService.sendException(telemetryEvent, errorMessage);
};
