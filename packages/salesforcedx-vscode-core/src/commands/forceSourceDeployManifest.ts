/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { TimestampConflictChecker } from '../commands/util/postconditionCheckers';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxPackageDirectories } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import { DeployExecutor } from './baseDeployRetrieve';
import {
  ConflictDetectionMessages,
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

export class LibrarySourceDeployManifestExecutor extends DeployExecutor<
  string
> {
  constructor() {
    super(
      nls.localize('force_source_deploy_text'),
      'force_source_deploy_with_manifest_beta'
    );
  }

  protected async getComponents(
    response: ContinueResponse<string>
  ): Promise<ComponentSet> {
    const packageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    const resolveSourcePaths = packageDirs.map(packageDir =>
      join(rootWorkspacePath, packageDir)
    );

    const componentSet = await ComponentSet.fromManifest({
      manifestPath: response.data,
      resolveSourcePaths
      // forceAddWildcards jab ?
    });

    return componentSet;
  }
}

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

  const messages: ConflictDetectionMessages = {
    warningMessageKey: 'conflict_detect_conflicts_during_deploy',
    commandHint: input => {
      return new SfdxCommandBuilder()
        .withArg('force:source:deploy')
        .withFlag('--manifest', input as string)
        .build()
        .toString();
    }
  };

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(manifestUri),
    new LibrarySourceDeployManifestExecutor(),
    new TimestampConflictChecker(true, messages)
  );
  await commandlet.run();
}
