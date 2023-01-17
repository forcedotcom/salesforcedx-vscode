/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, SfProject } from '@salesforce/core';
import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import {
  SourceTracking,
  SourceTrackingOptions
} from '@salesforce/source-tracking';
import * as fs from 'fs';
import { WorkspaceContext } from '../context/workspaceContext';

export class SourceTrackingService {
  private static activeSourceTrackingMap = new Map();

  public static async createSourceTracking(): Promise<void> {
    const projectPath = getRootWorkspacePath();
    if (
      SourceTrackingService.activeSourceTrackingMap &&
      SourceTrackingService.activeSourceTrackingMap.has(projectPath)
    ) {
      return this.activeSourceTrackingMap.get(projectPath);
    }

    const origCwd = process.cwd();
    if (origCwd !== projectPath && fs.existsSync(projectPath)) {
      // Change the environment to get the node process to use
      // the correct current working directory (process.cwd).
      // Without this, process.cwd() returns "'/'" and SourceTracking.create() fails.
      process.chdir(projectPath);
    }

    const connection = await WorkspaceContext.getInstance().getConnection();
    // It is important to pass the connection from WorkspaceContext to
    // Org.create() here.  Without this, core uses its cached version
    // of State Aggregator and the "No auth info found" error can be
    // thrown when deploying or retrieving immediately after creating a
    // default scratch org.
    const org: Org = await Org.create({ connection });
    const project = await SfProject.resolve(projectPath);
    const options: SourceTrackingOptions = {
      org,
      project,
      ignoreLocalCache: true,
      subscribeSDREvents: true,
      ignoreConflicts: false
    };

    const sourceTracker = await SourceTracking.create(options);
    this.activeSourceTrackingMap.set(projectPath, sourceTracker);

    if (process.cwd() !== origCwd) {
      // Change the directory back to the orig dir
      process.chdir(origCwd);
    }
  }
}
