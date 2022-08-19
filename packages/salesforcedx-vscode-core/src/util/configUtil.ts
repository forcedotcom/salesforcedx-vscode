/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigAggregator,
  OrgConfigProperties,
  SfConfigProperties,
  SfdxConfigAggregator,
  SfdxPropertyKeys,
  StateAggregator
} from '@salesforce/core';
import { getRootWorkspacePath } from './index';

export enum ConfigSource {
  Local,
  Global,
  None
}

export class ConfigUtil {
  public static async getConfigSource(key: string): Promise<ConfigSource> {
    const configAggregator = await ConfigUtil.getConfigAggregator();
    const configSource = configAggregator.getLocation(key);
    switch (configSource) {
      case ConfigAggregator.Location.LOCAL:
        return ConfigSource.Local;
        break;
      case ConfigAggregator.Location.GLOBAL:
        return ConfigSource.Global;
        break;
      default:
        return ConfigSource.None;
    }
  }

  public static async getUserConfiguredApiVersion(): Promise<
    string | undefined
  > {
    const configAggregator = await ConfigUtil.getConfigAggregator();
    const apiVersion = configAggregator.getPropertyValue(
      OrgConfigProperties.ORG_API_VERSION
    );
    return (apiVersion as string) || undefined;
  }

  public static async getDefaultUsernameOrAlias(): Promise<string | undefined> {
    const configAggregator = await ConfigUtil.getConfigAggregator();
    const defaultUsernameOrAlias = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_ORG
    ) as string;
    return defaultUsernameOrAlias;
  }

  public static async isGlobalDefaultUsername(): Promise<boolean> {
    const configSource: ConfigSource = await ConfigUtil.getConfigSource(
      OrgConfigProperties.TARGET_ORG
    );
    return configSource === ConfigSource.Global;
  }

  /*
   * Currently, the docs tell Users to manually create this entry in the .sfdx
   * configuration file.  For that reason, getTemplatesDirectory uses the
   * SfdxConfigAggregator specifically.
   */
  public static async getTemplatesDirectory(): Promise<string | undefined> {
    const sfdxConfigAggregator = await ConfigUtil.getSfdxConfigAggregator();
    const templatesDirectory = sfdxConfigAggregator.getPropertyValue(
      SfdxPropertyKeys.CUSTOM_ORG_METADATA_TEMPLATES
    );
    return (templatesDirectory as string) || undefined;
  }

  public static async isTelemetryDisabled(): Promise<boolean> {
    const configAggregator = await ConfigUtil.getConfigAggregator();
    const isTelemetryDisabled = await configAggregator.getPropertyValue(
      SfConfigProperties.DISABLE_TELEMETRY
    );
    return isTelemetryDisabled === 'true';
  }

  public static async getDefaultDevHubUsername(): Promise<string | undefined> {
    const configAggregator = await ConfigUtil.getConfigAggregator();

    const defaultDevHubUserName = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_DEV_HUB
    );
    return (defaultDevHubUserName as string) || undefined;
  }

  public static async getGlobalDefaultDevHubUsername(): Promise<
    string | undefined
  > {
    const globalConfigAggregator = await ConfigAggregator.create();
    const defaultGlobalDevHubUserName = globalConfigAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_DEV_HUB
    );
    return (defaultGlobalDevHubUserName as string) || undefined;
  }

  public static async getAllAliasesFor(username: string): Promise<string[]> {
    const stateAggregator = await StateAggregator.getInstance();
    // Without a call to clearInstance(), stateAggregator will not report
    // aliases that were created in the current running process.
    StateAggregator.clearInstance();
    const aliases = stateAggregator.aliases.getAll(username);
    return aliases;
  }

  private static async getConfigAggregator(
    sfdx: boolean = false
  ): Promise<ConfigAggregator> {
    const origCurrentWorkingDirectory = process.cwd();
    const rootWorkspacePath = getRootWorkspacePath();
    let configAggregator;
    // Change the current working directory to the project path,
    // so that ConfigAggregator reads the local project values
    process.chdir(rootWorkspacePath);
    try {
      configAggregator = sfdx
        ? await SfdxConfigAggregator.create()
        : await ConfigAggregator.create();
    } finally {
      // Change the current working directory back to what it was
      // before returning.
      // Wrapping this in a finally block ensures that the working
      // directory is switched back to what it was before this method
      // was called if SfdxConfigAggregator.create() throws an exception.
      process.chdir(origCurrentWorkingDirectory);
    }
    return configAggregator;
  }

  /*
   *  The SfdxConfigAggregator is used only to get configuration
   *  values that correspond with old/deprecated config keys.
   *  Currently, the key used for the custom templates
   *  directory is the only usage, since it is documented for use
   *  here: https://developer.salesforce.com/tools/vscode/en/user-guide/byotemplate#set-default-template-location
   */
  private static async getSfdxConfigAggregator(): Promise<ConfigAggregator> {
    const sfdxConfigAggregator = ConfigUtil.getConfigAggregator(true);
    return sfdxConfigAggregator;
  }
}
