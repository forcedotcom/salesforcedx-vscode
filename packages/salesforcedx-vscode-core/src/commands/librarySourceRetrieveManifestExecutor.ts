/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { join } from 'path';
import { nls } from '../messages';
import { SfdxPackageDirectories } from '../sfdxProject';
import { workspaceUtils } from '../util';
import { RetrieveExecutor } from './retrieveExecutor';

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

    return ComponentSet.fromManifest({
      manifestPath: response.data,
      resolveSourcePaths: packageDirs.map(relativeDir =>
        join(workspaceUtils.getRootWorkspacePath(), relativeDir)
      ),
      forceAddWildcards: true
    });
  }
}
