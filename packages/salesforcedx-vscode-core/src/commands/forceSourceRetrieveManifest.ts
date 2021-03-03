/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import {
  ConflictDetectionChecker,
  ConflictDetectionMessages
} from '../commands/util/postconditionCheckers';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxPackageDirectories } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';
import {
  createRetrieveOutput,
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  useBetaDeployRetrieve
} from './util';

export class ForceSourceRetrieveManifestExecutor extends SfdxCommandletExecutor<
  string
> {
  public build(manifestPath: string): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('--manifest', manifestPath)
      .withLogName('force_source_retrieve_with_manifest')
      .build();
  }
}

export class LibrarySourceRetrieveManifestExecutor extends LibraryCommandletExecutor<
  string
> {
  constructor() {
    super(
      'Retrieve With Manifest (beta)',
      'force_source_retrieve_with_manifest_beta',
      OUTPUT_CHANNEL
    );
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    // const packageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
    // const defaultOutput = join(
    //   getRootWorkspacePath(),
    //   (await SfdxPackageDirectories.getDefaultPackageDir()) ?? ''
    // );
    // const components = await ComponentSet.fromManifestFile(response.data, {
    //   resolve: packageDirs.map(relativeDir =>
    //     join(getRootWorkspacePath(), relativeDir)
    //   ),
    //   literalWildcard: true
    // });
    // const connection = await workspaceContext.getConnection();
    // const result = await components.retrieve(connection, defaultOutput, {
    //   merge: true
    // });

    // channelService.appendLine(createRetrieveOutput(result, packageDirs));

    // return result.success;
    return false;
  }
}

export async function forceSourceRetrieveManifest(explorerPath: vscode.Uri) {
  if (!explorerPath) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'forcesourcemanifest') {
      explorerPath = editor.document.uri;
    } else {
      const errorMessage = nls.localize(
        'force_source_retrieve_select_manifest'
      );
      telemetryService.sendException(
        'force_source_retrieve_with_manifest',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const messages: ConflictDetectionMessages = {
    warningMessageKey: 'conflict_detect_conflicts_during_retrieve',
    commandHint: input => {
      return new SfdxCommandBuilder()
        .withArg('force:source:retrieve')
        .withFlag('--manifest', input)
        .build()
        .toString();
    }
  };

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(explorerPath),
    useBetaDeployRetrieve([])
      ? new LibrarySourceRetrieveManifestExecutor()
      : new ForceSourceRetrieveManifestExecutor(),
    new ConflictDetectionChecker(messages)
  );
  await commandlet.run();
}
