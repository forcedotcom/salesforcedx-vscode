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
import { nls } from '../messages';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { salesforceCoreSettings } from '../settings';
import { RetrieveExecutor } from './retrieveExecutor';
import { FilePathGatherer, SfCommandlet } from './util';
import { getUriFromActiveEditor } from './util/getUriFromActiveEditor';

class LibraryRetrieveManifestExecutor extends RetrieveExecutor<string> {
  constructor() {
    super(nls.localize('retrieve_this_source_text'), 'retrieve_with_manifest');
    // Apply the global conflict detection setting for general retrieve commands
    this.ignoreConflicts = !salesforceCoreSettings.getConflictDetectionEnabled();
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

export const retrieveManifest = async (explorerPath: URI): Promise<void> => {
  const resolved =
    explorerPath ??
    (await getUriFromActiveEditor({
      message: 'retrieve_select_manifest',
      exceptionKey: 'retrieve_with_manifest'
    }));
  if (!resolved) {
    return;
  }

  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new FilePathGatherer(resolved),
    new LibraryRetrieveManifestExecutor()
  );
  await commandlet.run();
};
