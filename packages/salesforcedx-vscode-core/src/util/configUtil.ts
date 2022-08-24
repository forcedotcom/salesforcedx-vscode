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
    const configAggregator = await VSCEConfigAggregator.create();
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

  /*
   * The User-configured API version is set by the user, and is used to
   * override the API version that is otherwise gotten from the authenticated
   * Org in some cases, such as when deploying metadata.
   */
  public static async getUserConfiguredApiVersion(): Promise<
    string | undefined
  > {
    const configAggregator = await VSCEConfigAggregator.create();
    const apiVersion = configAggregator.getPropertyValue(
      OrgConfigProperties.ORG_API_VERSION
    );
    return apiVersion ? String(apiVersion) : undefined;
  }

  public static async getDefaultUsernameOrAlias(): Promise<string | undefined> {
    const configAggregator = await VSCEConfigAggregator.create();
    const defaultUsernameOrAlias = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_ORG
    );
    return defaultUsernameOrAlias ? String(defaultUsernameOrAlias) : undefined;
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
    const sfdxConfigAggregator = await VSCEConfigAggregator.create({
      sfdx: true
    });
    const templatesDirectory = sfdxConfigAggregator.getPropertyValue(
      SfdxPropertyKeys.CUSTOM_ORG_METADATA_TEMPLATES
    );
    return templatesDirectory ? String(templatesDirectory) : undefined;
  }

  public static async isTelemetryDisabled(): Promise<boolean> {
    const configAggregator = await VSCEConfigAggregator.create();
    const isTelemetryDisabled = configAggregator.getPropertyValue(
      SfConfigProperties.DISABLE_TELEMETRY
    );
    return isTelemetryDisabled === 'true';
  }

  public static async getDefaultDevHubUsername(): Promise<string | undefined> {
    const configAggregator = await VSCEConfigAggregator.create();

    const defaultDevHubUserName = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_DEV_HUB
    );
    return defaultDevHubUserName ? String(defaultDevHubUserName) : undefined;
  }

  public static async getGlobalDefaultDevHubUsername(): Promise<
    string | undefined
  > {
    const globalConfigAggregator = await VSCEConfigAggregator.create({
      globalValuesOnly: true
    });
    const defaultGlobalDevHubUserName = globalConfigAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_DEV_HUB
    );
    return defaultGlobalDevHubUserName
      ? String(defaultGlobalDevHubUserName)
      : undefined;
  }

  public static async getAllAliasesFor(username: string): Promise<string[]> {
    const stateAggregator = await StateAggregator.getInstance();
    // Without a call to clearInstance(), stateAggregator will not report
    // aliases that were created in the current running process.
    StateAggregator.clearInstance();
    const aliases = stateAggregator.aliases.getAll(username);
    return aliases;
  }
}

type VSCEConfigAggregatorOptions = {
  /*
   *  The SfdxConfigAggregator is used only to get configuration
   *  values that correspond with old/deprecated config keys.
   *  Currently, the key used for the custom templates
   *  directory is the only usage, since it is documented for use
   *  here: https://developer.salesforce.com/tools/vscode/en/user-guide/byotemplate#set-default-template-location
   */
  sfdx?: boolean;
  globalValuesOnly?: boolean;
};

/*
 * The VSCEConfigAggregator class is used to abstract away
 * some of the complexities around changing the process directory
 * that are needed to accurately retrieve configuration values
 * when using the ConfigAggregator in the VSCE context.
 */
class VSCEConfigAggregator {
  public static async create(
    options?: VSCEConfigAggregatorOptions
  ): Promise<ConfigAggregator> {
    return VSCEConfigAggregator.getConfigAggregator(options);
  }

  private static async getConfigAggregator(
    options: VSCEConfigAggregatorOptions = {
      sfdx: false,
      globalValuesOnly: false
    }
  ): Promise<ConfigAggregator> {
    let configAggregator;
    const currentWorkingDirectory = process.cwd();
    if (options.globalValuesOnly) {
      VSCEConfigAggregator.ensureProcessIsRunningUnderUserHomeDir(
        currentWorkingDirectory
      );
    } else {
      // Change the current working directory to the project path,
      // so that ConfigAggregator reads the local project values
      VSCEConfigAggregator.ensureProcessIsRunningUnderProjectRoot(
        currentWorkingDirectory
      );
    }
    try {
      configAggregator = options.sfdx
        ? await SfdxConfigAggregator.create()
        : await ConfigAggregator.create();

      // Force ConfigAggregator to load the most recent values from
      // the config file.  This prevents an issue where ConfigAggregator
      // can returned cached data instead of the most recent data.
      await configAggregator.reload();
    } finally {
      // Change the current working directory back to what it was
      // before returning.
      // Wrapping this in a finally block ensures that the working
      // directory is switched back to what it was before this method
      // was called if SfdxConfigAggregator.create() throws an exception.
      process.chdir(currentWorkingDirectory);
    }
    return configAggregator;
  }

  private static ensureProcessIsRunningUnderUserHomeDir(path: string) {
    const userHomePath = '/';
    if (path !== userHomePath) {
      process.chdir(userHomePath);
    }
  }

  private static ensureProcessIsRunningUnderProjectRoot(path: string) {
    const rootWorkspacePath = getRootWorkspacePath();
    if (path !== rootWorkspacePath) {
      process.chdir(rootWorkspacePath);
    }
  }
}
