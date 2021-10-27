/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxPackageDirectories, SfdxProjectConfig } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { RetrieveExecutor } from './baseDeployRetrieve';
import {
  FilePathGatherer,
  LibraryPathsGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

import {
  ConflictDetectionMessages,
  TimestampConflictChecker
} from './util/postconditionCheckers';

export class LibraryRetrieveSourcePathExecutor extends RetrieveExecutor<
  string | string[]
> {
  constructor() {
    super(
      nls.localize('force_source_retrieve_text'),
      'force_source_retrieve_with_sourcepath_beta'
    );
  }

  public async getComponents(
    response: ContinueResponse<string | string[]>
  ): Promise<ComponentSet> {
    const sourceApiVersion = (await SfdxProjectConfig.getValue('sourceApiVersion')) as string;
    const paths = typeof response.data === 'string' ? [response.data] : response.data;
    const componentSet = ComponentSet.fromSource(paths);
    componentSet.sourceApiVersion = sourceApiVersion;
    return componentSet;
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

export async function forceSourceRetrieveSourcePath(
  explorerPath: vscode.Uri,
  uris: vscode.Uri[]
) {
  if (uris && uris.length > 1) {
    await forceSourceRetrieveMultipleSourcePaths(uris);
    return;
  }

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
    new LibraryRetrieveSourcePathExecutor(),
    new SourcePathChecker()
  );
  await commandlet.run();
}

export async function forceSourceRetrieveMultipleSourcePaths(uris: vscode.Uri[]) {
  const messages: ConflictDetectionMessages = {
    warningMessageKey: 'conflict_detect_conflicts_during_retrieve',
    commandHint: input => {
      return new SfdxCommandBuilder()
        .withArg('force:source:retrieve')
        .withFlag('--sourcepath', input)
        .build()
        .toString();
    }
  };
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new LibraryPathsGatherer(uris),
    new LibraryRetrieveSourcePathExecutor(),
    new TimestampConflictChecker(false, messages)
  );

  await commandlet.run();
}
