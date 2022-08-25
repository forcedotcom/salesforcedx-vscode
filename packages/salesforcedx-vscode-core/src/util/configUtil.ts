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
import { WorkspaceContext } from '../context/workspaceContext';
import { getRootWorkspacePath } from './index';

const workspaceContext = WorkspaceContext.getInstance();

export enum ConfigSource {
  Local,
  Global,
  None
}

export class ConfigUtil {
  public static async getConfigSource(key: string): Promise<ConfigSource> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
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
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const apiVersion = configAggregator.getPropertyValue(
      OrgConfigProperties.ORG_API_VERSION
    );
    return apiVersion ? String(apiVersion) : undefined;
  }

  public static async getDefaultUsernameOrAlias(): Promise<string | undefined> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
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
    const sfdxConfigAggregator = await ConfigAggregatorProvider.getInstance().getSfdxConfigAggregator();
    const templatesDirectory = sfdxConfigAggregator.getPropertyValue(
      SfdxPropertyKeys.CUSTOM_ORG_METADATA_TEMPLATES
    );
    return templatesDirectory ? String(templatesDirectory) : undefined;
  }

  public static async isTelemetryDisabled(): Promise<boolean> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const isTelemetryDisabled = configAggregator.getPropertyValue(
      SfConfigProperties.DISABLE_TELEMETRY
    );
    return isTelemetryDisabled === 'true';
  }

  public static async getDefaultDevHubUsername(): Promise<string | undefined> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const defaultDevHubUserName = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_DEV_HUB
    );
    return defaultDevHubUserName ? String(defaultDevHubUserName) : undefined;
  }

  public static async getGlobalDefaultDevHubUsername(): Promise<
    string | undefined
  > {
    const globalConfigAggregator = await ConfigAggregatorProvider.getInstance().getGlobalConfigAggregator();
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

type ConfigAggregatorOptions = {
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
 * The ConfigAggregator class is used to abstract away
 * some of the complexities around changing the process directory
 * that are needed to accurately retrieve configuration values
 * when using the ConfigAggregator in the VSCE context.
 */
class ConfigAggregatorProvider {
  protected configAggregators: Map<string, ConfigAggregator>;
  protected sfdxConfigAggregators: Map<string, ConfigAggregator>;
  protected globalConfigAggregator: ConfigAggregator | undefined = undefined;

  private static instance?: ConfigAggregatorProvider;

  public static getInstance() {
    if (ConfigAggregatorProvider.instance === undefined) {
      ConfigAggregatorProvider.instance = new ConfigAggregatorProvider();
    }
    return ConfigAggregatorProvider.instance;
  }

  private constructor() {
    this.configAggregators = new Map<string, ConfigAggregator>();
    this.sfdxConfigAggregators = new Map<string, ConfigAggregator>();
  }

  public async getConfigAggregator(): Promise<ConfigAggregator> {
    const rootWorkspacePath = getRootWorkspacePath();
    let configAggregator = this.configAggregators.get(rootWorkspacePath);
    if (!configAggregator) {
      configAggregator = await this.createConfigAggregator();
      this.configAggregators.set(getRootWorkspacePath(), configAggregator);
    }
    return configAggregator;
  }

  public async getSfdxConfigAggregator(): Promise<ConfigAggregator> {
    let sfdxConfigAggregator = this.sfdxConfigAggregators.get(
      getRootWorkspacePath()
    );
    if (!sfdxConfigAggregator) {
      sfdxConfigAggregator = await this.createConfigAggregator({ sfdx: true });
      this.sfdxConfigAggregators.set(
        getRootWorkspacePath(),
        sfdxConfigAggregator
      );
    }
    return sfdxConfigAggregator;
  }

  public async getGlobalConfigAggregator(): Promise<ConfigAggregator> {
    if (!this.globalConfigAggregator) {
      this.globalConfigAggregator = await this.createConfigAggregator({
        globalValuesOnly: true
      });
    }
    return this.globalConfigAggregator;
  }

  public async reloadConfigAggregators() {
    console.log(
      'The .sfdx config file has changed.  Reloading ConfigAggregator values in the salesforcedx-vscode-core package.'
    );
    // Force ConfigAggregator to load the most recent values from
    // the config file.  This prevents an issue where ConfigAggregator
    // can returned cached data instead of the most recent data.
    const configAggregator = this.configAggregators.get(getRootWorkspacePath());
    if (configAggregator) await configAggregator.reload();

    const sfdx = this.sfdxConfigAggregators.get(getRootWorkspacePath());
    if (sfdx) await sfdx.reload();
  }

  private async createConfigAggregator(
    options: ConfigAggregatorOptions = {
      sfdx: false,
      globalValuesOnly: false
    }
  ): Promise<ConfigAggregator> {
    let configAggregator;
    const currentWorkingDirectory = process.cwd();
    if (options.globalValuesOnly) {
      ConfigAggregatorProvider.ensureProcessIsRunningUnderUserHomeDir(
        currentWorkingDirectory
      );
    } else {
      // Change the current working directory to the project path,
      // so that ConfigAggregator reads the local project values
      ConfigAggregatorProvider.ensureProcessIsRunningUnderProjectRoot(
        currentWorkingDirectory
      );
    }
    try {
      configAggregator = options.sfdx
        ? await SfdxConfigAggregator.create()
        : await ConfigAggregator.create();
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
