/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { TimestampConflictChecker } from '../commands/util/postconditionCheckers';
import { getConflictMessagesFor } from '../conflict/messages';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { LibrarySourceDeployManifestExecutor } from './librarySourceDeployManifestExecutor';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

export async function forceSourceDeployManifest(manifestUri: vscode.Uri) {
  if (!manifestUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'forcesourcemanifest') {
      manifestUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize('force_source_deploy_select_manifest');
      telemetryService.sendException(
        'force_source_deploy_with_manifest',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const messages = getConflictMessagesFor(
    'force_source_deploy_with_manifest_beta'
  );

  if (messages) {
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new FilePathGatherer(manifestUri),
      new LibrarySourceDeployManifestExecutor(),
      new TimestampConflictChecker(true, messages)
    );
    await commandlet.run();
  }
}
