/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxProject, SfdxProjectJson } from '@salesforce/core';
import { AnyJson, JsonMap } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';

import { SFDX_PROJECT_FILE } from '../constants';
import { isSfdxProjectOpened } from '../predicates';
import { SfdxProjectPath } from '../sfdxProject';

export default class SfdxProjectConfig {
  private static instance: SfdxProjectJson;
  private constructor() {
    throw new Error(
      'Error: *** call SfdxProject.getInstance() to get the singleton instance of this class ***'
    );
  }

  private static async initializeSfdxProjectConfig() {
    if (isSfdxProjectOpened.apply(vscode.workspace).result) {
      const sfdxProjectPath = SfdxProjectPath.getPath();
      const sfdxProject = await SfdxProject.resolve(sfdxProjectPath);
      SfdxProjectConfig.instance = await sfdxProject.retrieveSfdxProjectJson();

      const fileWatcher = vscode.workspace.createFileSystemWatcher(
        path.join(sfdxProjectPath, SFDX_PROJECT_FILE)
      );
      fileWatcher.onDidChange(async () => {
        SfdxProjectConfig.instance.read();
        console.log('SFDX Project Config Object', SfdxProjectConfig.instance);
      });
    }
  }

  public static async getInstance(): Promise<SfdxProjectJson> {
    if (!SfdxProjectConfig.instance) {
      await SfdxProjectConfig.initializeSfdxProjectConfig();
    }
    return SfdxProjectConfig.instance;
  }

  public static async getValue(key: string): Promise<AnyJson | undefined> {
    const projectConfig = await SfdxProjectConfig.getInstance();
    return projectConfig.get(key);
  }
}
