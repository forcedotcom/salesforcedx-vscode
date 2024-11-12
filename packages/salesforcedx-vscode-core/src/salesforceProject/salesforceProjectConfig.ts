/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProject, SfProjectJson } from '@salesforce/core-bundle';
import { JsonArray } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { SFDX_PROJECT_FILE } from '../constants';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { isSalesforceProjectOpened } from '../predicates';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';

/**
 * Class representing the local sfdx-project.json file.
 * Does not contain global values.
 */
export default class SalesforceProjectConfig {
  private static instance: SfProjectJson;
  private constructor() {
    throw new Error('Error: *** call SfProject.getInstance() to get the singleton instance of this class ***');
  }

  private static async initializeSalesforceProjectConfig() {
    if (!SalesforceProjectConfig.instance && isSalesforceProjectOpened.apply(vscode.workspace).result) {
      const salesforceProjectPath = workspaceUtils.getRootWorkspacePath();
      try {
        const salesforceProject = await SfProject.resolve(salesforceProjectPath);
        SalesforceProjectConfig.instance = await salesforceProject.retrieveSfProjectJson();
        const fileWatcher = vscode.workspace.createFileSystemWatcher(
          path.join(salesforceProjectPath, SFDX_PROJECT_FILE)
        );
        fileWatcher.onDidChange(async () => {
          try {
            await SalesforceProjectConfig.instance.read();
          } catch (error) {
            SalesforceProjectConfig.handleError(error);
            throw error;
          }
        });
      } catch (error) {
        SalesforceProjectConfig.handleError(error);
        throw error;
      }
    }
  }

  private static handleError(error: any) {
    let errorMessage = error.message;
    if (error.name === 'JsonParseError') {
      errorMessage = nls.localize('error_parsing_sfdx_project_file', error.path, error.message);
    }
    notificationService.showErrorMessage(errorMessage);
    telemetryService.sendException('project_config', errorMessage);
  }

  public static async getInstance(): Promise<SfProjectJson> {
    if (!SalesforceProjectConfig.instance) {
      await SalesforceProjectConfig.initializeSalesforceProjectConfig();
    }
    return SalesforceProjectConfig.instance;
  }

  public static async getValue<T extends JsonArray | string | undefined>(key: string): Promise<T> {
    const projectConfig = await SalesforceProjectConfig.getInstance();
    return projectConfig.get(key) as T;
  }
}
