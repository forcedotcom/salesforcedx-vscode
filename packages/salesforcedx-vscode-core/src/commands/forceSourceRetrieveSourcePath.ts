/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

import {
    CancelResponse, channelService, ContinueResponse, notificationService, PostconditionChecker,
    SfdxCommandBuilder, SfdxPackageDirectories, SfdxProjectConfig
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';

import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { RetrieveExecutor } from './baseDeployRetrieve';
import {
    ConflictDetectionMessages, LibraryPathsGatherer, SfdxCommandlet, SfdxWorkspaceChecker
} from './util';

export class LibraryRetrieveSourcePathExecutor extends RetrieveExecutor<
  string[]
> {
  constructor() {
    super(
      nls.localize('force_source_retrieve_text'),
      'force_source_retrieve_with_sourcepath_beta'
    );
  }

  public async getComponents(
    response: ContinueResponse<string[]>
  ): Promise<ComponentSet> {
    const sourceApiVersion = (await SfdxProjectConfig.getValue(
      'sourceApiVersion'
    )) as string;
    const paths =
      typeof response.data === 'string' ? [response.data] : response.data;
    const componentSet = ComponentSet.fromSource(paths);
    componentSet.sourceApiVersion = sourceApiVersion;
    return componentSet;
  }
}

export class SourcePathChecker implements PostconditionChecker<string[]> {
  public async check(
    inputs: ContinueResponse<string[]> | CancelResponse
  ): Promise<ContinueResponse<string[]> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const sourcePaths = inputs.data;
      try {
        for (const sourcePath of sourcePaths) {
          const isInSfdxPackageDirectory = await SfdxPackageDirectories.isInPackageDirectory(
            sourcePath
          );

          if (!isInSfdxPackageDirectory) {
            throw nls.localize(
              'error_source_path_not_in_package_directory_text'
            );
          }
        }

        return inputs;
      } catch (error) {
        telemetryService.sendException(
          'force_source_retrieve_with_sourcepath',
          `Error while parsing package directories. ${error.message}`
        );
      }

      const errorMessage = nls.localize(
        'error_source_path_not_in_package_directory_text'
      );
      telemetryService.sendException(
        'force_source_retrieve_with_sourcepath',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
    }
    return { type: 'CANCEL' };
  }
}

export const forceSourceRetrieveSourcePaths = async (
  sourceUri: vscode.Uri | undefined,
  uris: vscode.Uri[] | undefined
) => {
  if (!sourceUri) {
    // When the source is retrieved via the command palette, both sourceUri and uris are
    // each undefined, and sourceUri needs to be obtained from the active text editor.
    sourceUri = getUriFromActiveEditor();
    if (!sourceUri) {
      return;
    }
  }

  // When a single file is selected and "Retrieve Source from Org" is executed,
  // sourceUri is passed, and the uris array contains a single element, the same
  // path as sourceUri.
  //
  // When multiple files are selected and "Retrieve Source from Org" is executed,
  // sourceUri is passed, and is the path to the first selected file, and the uris
  // array contains an array of all paths that were selected.
  //
  // When editing a file and "Retrieve This Source from Org" is executed,
  // sourceUri is passed, but uris is undefined.
  if (!uris || uris.length < 1) {
    uris = [];
    uris.push(sourceUri);
  }

  const commandlet = new SfdxCommandlet<string[]>(
    new SfdxWorkspaceChecker(),
    new LibraryPathsGatherer(uris),
    new LibraryRetrieveSourcePathExecutor(),
    new SourcePathChecker()
  );

  await commandlet.run();
};

export const getUriFromActiveEditor = (): vscode.Uri | undefined => {
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
