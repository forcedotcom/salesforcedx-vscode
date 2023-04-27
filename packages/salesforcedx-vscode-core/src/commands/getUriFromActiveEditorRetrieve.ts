/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';

export const getUriFromActiveEditorRetrieve = (): vscode.Uri | undefined => {
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.languageId !== 'forcesourcemanifest') {
    return editor.document.uri;
  }

  const errorMessage = nls.localize(
    'force_source_retrieve_select_file_or_directory'
  );
  telemetryService.sendException(
    'force_source_retrieve_with_sourcepath',
    errorMessage
  );
  notificationService.showErrorMessage(errorMessage);
  channelService.appendLine(errorMessage);
  channelService.showChannelOutput();

  return undefined;
};
