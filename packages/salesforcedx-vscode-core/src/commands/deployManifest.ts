/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse, SfWorkspaceChecker, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { join } from 'node:path';
import { URI } from 'vscode-uri';
import { TimestampConflictChecker } from '../commands/util/timestampConflictChecker';
import { getConflictMessagesFor } from '../conflict/messages';
import { nls } from '../messages';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { DeployExecutor } from './baseDeployRetrieve';
import { FilePathGatherer, SfCommandlet } from './util';
import { getUriFromActiveEditor } from './util/getUriFromActiveEditor';

class LibraryDeployManifestExecutor extends DeployExecutor<string> {
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

export const deployManifest = async (manifestUri: URI) => {
  const resolved =
    manifestUri ??
    (await getUriFromActiveEditor({
      message: 'deploy_select_manifest',
      exceptionKey: 'deploy_with_manifest'
    }));
  if (!resolved) {
    return;
  }

  const messages = getConflictMessagesFor('deploy_with_manifest');

  if (messages) {
    const commandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      new FilePathGatherer(resolved),
      new LibraryDeployManifestExecutor(),
      new TimestampConflictChecker(true, messages)
    );
    await commandlet.run();
  }
};
