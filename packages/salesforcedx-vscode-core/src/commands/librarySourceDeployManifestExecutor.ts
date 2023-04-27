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
import { DeployExecutor } from './deployExecutor';

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
    return ComponentSet.fromManifest({
      manifestPath: response.data,
      resolveSourcePaths: packageDirs.map(dir =>
        join(workspaceUtils.getRootWorkspacePath(), dir)
      )
    });
  }
}
