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
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';

type input =
  | {
      message: 'deploy_select_file_or_directory';
      exceptionKey: 'deploy_with_sourcepath';
    }
  | {
      message: 'retrieve_select_file_or_directory';
      exceptionKey: 'retrieve_with_sourcepath';
    };

export const getUriFromActiveEditor = async ({ message, exceptionKey }: input): Promise<URI | undefined> => {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId !== 'forcesourcemanifest') {
    return editor?.document.uri;
  }

  const errorMessage = nls.localize(message);
  telemetryService.sendException(exceptionKey, errorMessage);
  await notificationService.showErrorMessage(errorMessage);
  channelService.appendLine(errorMessage);
  channelService.showChannelOutput();

  return undefined;
};
