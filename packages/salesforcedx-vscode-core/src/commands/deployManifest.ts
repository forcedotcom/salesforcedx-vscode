/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { TimestampConflictChecker } from '../commands/util/timestampConflictChecker';
import { getConflictMessagesFor } from '../conflict/messages';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import { DeployExecutor } from './baseDeployRetrieve';
import { FilePathGatherer, SfCommandlet, SfWorkspaceChecker } from './util';

export class LibraryDeployManifestExecutor extends DeployExecutor<string> {
  constructor() {
    super(nls.localize('deploy_this_source_text'), 'deploy_with_manifest');
  }

  protected async getComponents(response: ContinueResponse<string>): Promise<ComponentSet> {
    const packageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    const resolveSourcePaths = packageDirs.map(packageDir => join(rootWorkspacePath, packageDir));
    const componentSet = await ComponentSet.fromManifest({
      manifestPath: response.data,
      resolveSourcePaths,
      forceAddWildcards: undefined
    });

    return componentSet;
  }
}

export const deployManifest = async (manifestUri: vscode.Uri) => {
  if (!manifestUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'forcesourcemanifest') {
      manifestUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize('deploy_select_manifest');
      telemetryService.sendException('deploy_with_manifest', errorMessage);
      void notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const messages = getConflictMessagesFor('deploy_with_manifest');

  if (messages) {
    const commandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      new FilePathGatherer(manifestUri),
      new LibraryDeployManifestExecutor(),
      new TimestampConflictChecker(true, messages)
    );
    await commandlet.run();
  }
};
