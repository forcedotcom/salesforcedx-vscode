/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { getConflictMessagesFor } from '../conflict/messages';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { DeployExecutor } from './baseDeployRetrieve';
import { SourcePathChecker } from './retrieveSourcePath';
import { LibraryPathsGatherer, SfCommandlet, SfWorkspaceChecker } from './util';
import { CompositePostconditionChecker } from './util/compositePostconditionChecker';
import { TimestampConflictChecker } from './util/timestampConflictChecker';

export class LibraryDeploySourcePathExecutor extends DeployExecutor<string[]> {
  constructor() {
    super(nls.localize('deploy_this_source_text'), 'deploy_with_sourcepath');
  }

  public async getComponents(
    response: ContinueResponse<string[]>
  ): Promise<ComponentSet> {
    const paths =
      typeof response.data === 'string' ? [response.data] : response.data;
    const componentSet = ComponentSet.fromSource(paths);

    return componentSet;
  }
}

export const deploySourcePaths = async (
  sourceUri: vscode.Uri | vscode.Uri[] | undefined,
  uris: vscode.Uri[] | undefined
) => {
  if (!sourceUri) {
    // When the source is deployed via the command palette, both sourceUri and uris are
    // each undefined, and sourceUri needs to be obtained from the active text editor.
    sourceUri = getUriFromActiveEditor();
    if (!sourceUri) {
      return;
    }
  }

  // When a single file is selected and "Deploy Source from Org" is executed,
  // sourceUri is passed, and the uris array contains a single element, the same
  // path as sourceUri.
  //
  // When multiple files are selected and "Deploy Source from Org" is executed,
  // sourceUri is passed, and is the path to the first selected file, and the uris
  // array contains an array of all paths that were selected.
  //
  // When editing a file and "Deploy This Source from Org" is executed,
  // sourceUri is passed, but uris is undefined.
  if (!uris || uris.length < 1) {
    if (Array.isArray(sourceUri)) {
      // When "Push-or-deploy-on-save" is enabled, the first parameter
      // passed in (sourceUri) is actually an array and not a single URI.
      uris = sourceUri;
    } else {
      uris = [sourceUri];
    }
  }

  const messages = getConflictMessagesFor('deploy_with_sourcepath');

  if (messages) {
    const commandlet = new SfCommandlet<string[]>(
      new SfWorkspaceChecker(),
      new LibraryPathsGatherer(uris),
      new LibraryDeploySourcePathExecutor(),
      new CompositePostconditionChecker(
        new SourcePathChecker(),
        new TimestampConflictChecker(false, messages)
      )
    );

    await commandlet.run();
  }
};

export const getUriFromActiveEditor = (): vscode.Uri | undefined => {
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.languageId !== 'forcesourcemanifest') {
    return editor.document.uri;
  }

  const errorMessage = nls.localize('deploy_select_file_or_directory');
  telemetryService.sendException('deploy_with_sourcepath', errorMessage);
  notificationService.showErrorMessage(errorMessage);
  channelService.appendLine(errorMessage);
  channelService.showChannelOutput();

  return undefined;
};
