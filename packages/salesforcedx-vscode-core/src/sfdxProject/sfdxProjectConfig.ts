/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxProject, SfdxProjectJson } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';

import { SFDX_PROJECT_FILE } from '../constants';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { isSfdxProjectOpened } from '../predicates';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';

/**
 * Class representing the local sfdx-project.json file.
 * Does not contain global values.
 */
export default class SfdxProjectConfig {
  private static instance: SfdxProjectJson;
  private constructor() {
    throw new Error(
      'Error: *** call SfdxProject.getInstance() to get the singleton instance of this class ***'
    );
  }

  private static async initializeSfdxProjectConfig() {
    if (
      !SfdxProjectConfig.instance &&
      isSfdxProjectOpened.apply(vscode.workspace).result
    ) {
      const sfdxProjectPath = getRootWorkspacePath();
      try {
        const sfdxProject = await SfdxProject.resolve(sfdxProjectPath);
        SfdxProjectConfig.instance = await sfdxProject.retrieveSfdxProjectJson();
        const fileWatcher = vscode.workspace.createFileSystemWatcher(
          path.join(sfdxProjectPath, SFDX_PROJECT_FILE)
        );
        fileWatcher.onDidChange(async () => {
          try {
            await SfdxProjectConfig.instance.read();
          } catch (error) {
            SfdxProjectConfig.handleError(error);
            throw error;
          }
        });
      } catch (error) {
        SfdxProjectConfig.handleError(error);
        throw error;
      }
    }
  }

  private static handleError(error: any) {
    let errorMessage = error.message;
    if (error.name === 'JsonParseError') {
      errorMessage = nls.localize(
        'error_parsing_sfdx_project_file',
        error.path,
        error.message
      );
    }
    notificationService.showErrorMessage(errorMessage);
    telemetryService.sendException('project_config', errorMessage);
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
