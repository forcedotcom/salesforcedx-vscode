/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { MessageKey } from '../../messages/i18n';
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';

export const getUriFromActiveEditor = async ({
  message,
  exceptionKey
}: {
  message: MessageKey;
  exceptionKey: string;
}): Promise<URI | undefined> => {
  const editor = vscode.window.activeTextEditor;
  if (editor && editor?.document.languageId !== 'forcesourcemanifest') {
    return editor?.document.uri;
  }

  const errorMessage = nls.localize(message);
  telemetryService.sendException(exceptionKey, errorMessage);
  await notificationService.showErrorMessage(errorMessage);
  channelService.appendLine(errorMessage);
  channelService.showChannelOutput();

  return undefined;
};
