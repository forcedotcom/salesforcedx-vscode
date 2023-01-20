/*
 * Copyright (c) 2023, salesforce.com, inc.
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
  public static async createSourceTracking(): Promise<SourceTracking> {
    const projectPath = getRootWorkspacePath();
    const project = await SfProject.resolve(projectPath);

    // const connection = await WorkspaceContextUtil.getInstance().getConnection();
    // It is important to pass the connection from WorkspaceContext to
    // Org.create() here.  Without this, core uses its cached version
    // of State Aggregator and the "No auth info found" error can be
    // thrown when deploying or retrieving immediately after creating a
    // default scratch org.
    // TODO: See if the No auth info found error can be reproduced building the org this way
    const aliasOrUsername = await ConfigUtil.getDefaultUsernameOrAlias();
    const org: Org = await Org.create({ aliasOrUsername });

    const options: SourceTrackingOptions = {
      org,
      project,
      ignoreLocalCache: true,
      subscribeSDREvents: true,
      ignoreConflicts: false
    };
    const sourceTracking = await SourceTracking.create(options);
    return sourceTracking;
  }
}
