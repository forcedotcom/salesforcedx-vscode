/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, SfProject } from '@salesforce/core';
import {
  ConfigUtil,
  getRootWorkspacePath
} from '@salesforce/salesforcedx-utils-vscode';
import {
  SourceTracking,
  SourceTrackingOptions
} from '@salesforce/source-tracking';

export class SourceTrackingService {
  private _sourceTracking: SourceTracking | undefined;

  public constructor(sourceTracking?: SourceTracking) {
    if (sourceTracking !== undefined) {
      this._sourceTracking = sourceTracking;
    }
  }

  public async createSourceTracking(): Promise<SourceTracking> {
    const projectPath = getRootWorkspacePath();
    const aliasOrUsername = await ConfigUtil.getDefaultUsernameOrAlias();
    const org: Org = await Org.create({ aliasOrUsername });
    const project = await SfProject.resolve(projectPath);
    const options: SourceTrackingOptions = {
      org,
      project,
      ignoreLocalCache: true,
      subscribeSDREvents: true,
      ignoreConflicts: false
    };

    // Change the environment to get the node process to use
    // the correct current working directory (process.cwd).
    // Without this, process.cwd() returns "'/'" and SourceTracking.create() fails.
    // const origCwd = process.cwd();
    process.chdir(projectPath);
    const tracking = await SourceTracking.create(options);
    // SourceTracking returns different results when process is changed back
    // process.chdir(origCwd);
    return tracking;
  }
}
