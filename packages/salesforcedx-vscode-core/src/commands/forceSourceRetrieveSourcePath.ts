/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import { SfdxPackageDirectories } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import {
  APEX_CLASS_EXTENSION,
  APEX_TRIGGER_EXTENSION,
  VISUALFORCE_COMPONENT_EXTENSION,
  VISUALFORCE_PAGE_EXTENSION
} from './templates/metadataTypeConstants';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';
import { LibraryCommandletExecutor } from './util/libraryCommandlet';

export class ForceSourceRetrieveSourcePathExecutor extends SfdxCommandletExecutor<
  string
> {
  public build(sourcePath: string): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('--sourcepath', sourcePath)
      .withLogName('force_source_retrieve_with_sourcepath')
      .build();
  }
}

export class SourcePathChecker implements PostconditionChecker<string> {
  public async check(
    inputs: ContinueResponse<string> | CancelResponse
  ): Promise<ContinueResponse<string> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const sourcePath = inputs.data;
      try {
        const isInSfdxPackageDirectory = await SfdxPackageDirectories.isInPackageDirectory(
          sourcePath
        );
        if (isInSfdxPackageDirectory) {
          return inputs;
        }
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

export async function forceSourceRetrieveSourcePath(explorerPath: vscode.Uri) {
  if (!explorerPath) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'forcesourcemanifest') {
      explorerPath = editor.document.uri;
    } else {
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
      return;
    }
  }

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(explorerPath),
    useBetaRetrieve(explorerPath)
      ? new LibraryRetrieveSourcePathExecutor()
      : new ForceSourceRetrieveSourcePathExecutor(),
    new SourcePathChecker()
  );
  await commandlet.run();
}

// this supported types logic is temporary until we have a way of generating the metadata type from the path
// once we have the metadata type we can check to see if it is a toolingsupportedtype from that util
export function useBetaRetrieve(explorerPath: vscode.Uri): boolean {
  const filePath = explorerPath.fsPath;
  const betaDeployRetrieve = sfdxCoreSettings.getBetaDeployRetrieve();
  const supportedType =
    path.extname(filePath) === APEX_CLASS_EXTENSION ||
    path.extname(filePath) === APEX_TRIGGER_EXTENSION ||
    path.extname(filePath) === VISUALFORCE_COMPONENT_EXTENSION ||
    path.extname(filePath) === VISUALFORCE_PAGE_EXTENSION;
  return betaDeployRetrieve && supportedType;
}

export class LibraryRetrieveSourcePathExecutor extends LibraryCommandletExecutor<
  string
> {
  public async execute(response: ContinueResponse<string>): Promise<void> {
    this.setStartTime();

    try {
      await this.build(
        'Retrieve (Beta)',
        'force_source_retrieve_with_sourcepath_beta'
      );

      if (this.sourceClient === undefined) {
        throw new Error('SourceClient is not established');
      }

      this.sourceClient.tooling.retrieveWithPaths = this.retrieveWrapper(
        this.sourceClient.tooling.retrieveWithPaths
      );
      const retrieveOpts = {
        paths: [response.data]
      };
      await this.sourceClient.tooling.retrieveWithPaths(retrieveOpts);
      this.logMetric();
    } catch (e) {
      telemetryService.sendException(
        'force_source_retrieve_with_sourcepath_beta',
        e.message
      );
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
    }
  }
}
