/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  CONFLICT_DETECTION_ENABLED,
  INTERNAL_DEVELOPMENT_FLAG,
  PUSH_OR_DEPLOY_ON_SAVE_ENABLED,
  RETRIEVE_TEST_CODE_COVERAGE,
  SFDX_CORE_CONFIGURATION_NAME,
  SHOW_CLI_SUCCESS_INFO_MSG,
  TELEMETRY_ENABLED,
  TOOLING_DEPLOYS
} from '../constants';
/**
 * A centralized location for interacting with sfdx-core settings.
 */
export class SfdxCoreSettings {
  private static instance: SfdxCoreSettings;

  public static getInstance() {
    if (!SfdxCoreSettings.instance) {
      SfdxCoreSettings.instance = new SfdxCoreSettings();
    }
    return SfdxCoreSettings.instance;
  }

  /**
   * Get the configuration for a sfdx-core
   */
  public getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SFDX_CORE_CONFIGURATION_NAME);
  }

  public getShowCLISuccessMsg(): boolean {
    return this.getConfigValue<boolean>(SHOW_CLI_SUCCESS_INFO_MSG, true);
  }

  // checks for Microsoft's telemetry setting as well as Salesforce's telemetry setting.
  public getTelemetryEnabled(): boolean {
    return (
      vscode.workspace
        .getConfiguration('telemetry')
        .get<boolean>('enableTelemetry', true) &&
      this.getConfigValue<boolean>(TELEMETRY_ENABLED, true)
    );
  }

  public async updateShowCLISuccessMsg(value: boolean) {
    await this.setConfigValue(SHOW_CLI_SUCCESS_INFO_MSG, value);
  }

  public getPushOrDeployOnSaveEnabled(): boolean {
    return this.getConfigValue<boolean>(PUSH_OR_DEPLOY_ON_SAVE_ENABLED, false);
  }

  public getRetrieveTestCodeCoverage(): boolean {
    return this.getConfigValue(RETRIEVE_TEST_CODE_COVERAGE, false);
  }

  public getInternalDev(): boolean {
    return this.getConfigValue(INTERNAL_DEVELOPMENT_FLAG, false);
  }

  public getConflictDetectionEnabled(): boolean {
    return this.getConfigValue(CONFLICT_DETECTION_ENABLED, false);
  }

  public getToolingDeploys(): boolean {
    return this.getConfigValue(TOOLING_DEPLOYS, true);
  }

  private getConfigValue<T>(key: string, defaultValue: T): T {
    return this.getConfiguration().get<T>(key, defaultValue);
  }

  private async setConfigValue(key: string, value: any) {
    await this.getConfiguration().update(key, value);
  }
}
