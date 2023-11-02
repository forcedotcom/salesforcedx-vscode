/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxPackageDirectories } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import { RetrieveExecutor } from './baseDeployRetrieve';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

export class LibrarySourceRetrieveManifestExecutor extends RetrieveExecutor<
  string
> {
  constructor() {
    super(
      nls.localize('force_source_retrieve_text'),
      'force_source_retrieve_with_manifest_beta'
    );
  }

  protected async getComponents(
    response: ContinueResponse<string>
  ): Promise<ComponentSet> {
    const packageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
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

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(explorerPath),
    new LibrarySourceRetrieveManifestExecutor()
  );
  await commandlet.run();
}
