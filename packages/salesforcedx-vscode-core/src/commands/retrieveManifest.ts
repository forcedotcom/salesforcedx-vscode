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
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import { RetrieveExecutor } from './baseDeployRetrieve';
import { FilePathGatherer, SfCommandlet, SfWorkspaceChecker } from './util';

export class LibraryRetrieveManifestExecutor extends RetrieveExecutor<string> {
  constructor() {
    super(nls.localize('retrieve_this_source_text'), 'retrieve_with_manifest');
  }

  protected async getComponents(response: ContinueResponse<string>): Promise<ComponentSet> {
    const packageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    const resolveSourcePaths = packageDirs.map(packageDir => join(rootWorkspacePath, packageDir));

    const componentSet = await ComponentSet.fromManifest({
      manifestPath: response.data,
      resolveSourcePaths,
      forceAddWildcards: true
    });

    return componentSet;
  }
}

export const retrieveManifest = async (explorerPath: vscode.Uri): Promise<void> => {
  if (!explorerPath) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'forcesourcemanifest') {
      explorerPath = editor.document.uri;
    } else {
      const errorMessage = nls.localize('retrieve_select_manifest');
      telemetryService.sendException('retrieve_with_manifest', errorMessage);
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new FilePathGatherer(explorerPath),
    new LibraryRetrieveManifestExecutor()
  );
  await commandlet.run();
};
