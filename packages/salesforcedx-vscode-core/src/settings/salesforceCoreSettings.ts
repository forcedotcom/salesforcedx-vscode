/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import {
  ALL_EXCEPTION_CATCHER_ENABLED,
  ENV_NODE_EXTRA_CA_CERTS,
  ENV_SF_LOG_LEVEL,
  INTERNAL_DEVELOPMENT_FLAG,
  TELEMETRY_ENABLED
} from '../constants';
/**
 * A centralized location for interacting with sfdx-core settings.
 */
export class SalesforceCoreSettings {
  private static instance: SalesforceCoreSettings;

  public static getInstance() {
    if (!SalesforceCoreSettings.instance) {
      SalesforceCoreSettings.instance = new SalesforceCoreSettings();
    }
    return SalesforceCoreSettings.instance;
  }

  /**
   * Get the configuration for a sfdx-core
   */
  public getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SFDX_CORE_CONFIGURATION_NAME);
  }

  // checks for Microsoft's telemetry setting as well as Salesforce's telemetry setting.
  public getTelemetryEnabled(): boolean {
    return (
      vscode.workspace.getConfiguration('telemetry').get<boolean>('enableTelemetry', true) &&
      this.getConfigValue<boolean>(TELEMETRY_ENABLED, true)
    );
  }

  public getEnableAllExceptionCatcher(): boolean {
    return this.getConfigValue<boolean>(ALL_EXCEPTION_CATCHER_ENABLED, false);
  }

  public getInternalDev(): boolean {
    return this.getConfigValue(INTERNAL_DEVELOPMENT_FLAG, false);
  }

  public getNodeExtraCaCerts(): string {
    return this.getConfigValue(ENV_NODE_EXTRA_CA_CERTS, process.env.NODE_EXTRA_CA_CERTS ?? '');
  }

  public getSfLogLevel(): string {
    return this.getConfigValue(ENV_SF_LOG_LEVEL, process.env.SF_LOG_LEVEL ?? 'fatal');
  }

  private getConfigValue<T>(key: string, defaultValue: T): T {
    return this.getConfiguration().get<T>(key, defaultValue);
  }
}
