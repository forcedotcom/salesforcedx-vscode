/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProject, SfProjectJson } from '@salesforce/core';
import { JsonArray } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { SFDX_PROJECT_FILE } from '../constants';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { isSfdxProjectOpened } from '../predicates';
import { telemetryService } from '../telemetry';
import { normalizeError, workspaceUtils } from '../util';

/**
 * Class representing the local sfdx-project.json file.
 * Does not contain global values.
 */
export default class SfdxProjectConfig {
  private static instance: SfProjectJson;
  private constructor() {
    throw new Error(
      'Error: *** call SfProject.getInstance() to get the singleton instance of this class ***'
    );
  }

  private static async initializeSfdxProjectConfig() {
    if (
      !SfdxProjectConfig.instance &&
      isSfdxProjectOpened.apply(vscode.workspace).result
    ) {
      const sfdxProjectPath = workspaceUtils.getRootWorkspacePath();
      try {
        const sfdxProject = await SfProject.resolve(sfdxProjectPath);
        SfdxProjectConfig.instance = await sfdxProject.retrieveSfProjectJson();
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
    const err = normalizeError(error) as Error & { path?: string };
    let errorMessage = err.message;
    if (err.name === 'JsonParseError') {
      errorMessage = nls.localize(
        'error_parsing_sfdx_project_file',
        err.path ?? 'Uknown path',
        err.message
      );
    }
    void notificationService.showErrorMessage(errorMessage);
    telemetryService.sendException('project_config', errorMessage);
  }

  public static async getInstance(): Promise<SfProjectJson> {
    if (!SfdxProjectConfig.instance) {
      await SfdxProjectConfig.initializeSfdxProjectConfig();
    }
    return SfdxProjectConfig.instance;
  }

  public static async getValue<T extends JsonArray | string | undefined>(key: string): Promise<T> {
    const projectConfig = await SfdxProjectConfig.getInstance();
    return projectConfig.get(key) as T;
  }
}
