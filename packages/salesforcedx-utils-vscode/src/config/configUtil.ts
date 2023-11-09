/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Config,
  ConfigAggregator,
  Org,
  OrgConfigProperties,
  StateAggregator
} from '@salesforce/core';
import { workspaceUtils } from '..';
import {
  SF_CONFIG_DISABLE_TELEMETRY,
  TARGET_DEV_HUB_KEY,
  TARGET_ORG_KEY
} from '../constants';
import { ConfigAggregatorProvider } from '../providers';
import { TelemetryProvider } from '../telemetry/telemetry';

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
    try {
      const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
      const defaultUsernameOrAlias = configAggregator.getPropertyValue(
        TARGET_ORG_KEY
      );
      if (!defaultUsernameOrAlias) {
        return undefined;
      }

      return JSON.stringify(defaultUsernameOrAlias).replace(/\"/g, '');
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        TelemetryProvider.getInstance().sendException(
          'get_default_username_alias',
          err.message
        );
      }
      throw err;
    }
  }

  public static async isGlobalDefaultUsername(): Promise<boolean> {
    const configSource: ConfigSource = await ConfigUtil.getConfigSource(
      TARGET_ORG_KEY
    );
    return configSource === ConfigSource.Global;
  }

  public static async getTemplatesDirectory(): Promise<string | undefined> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const templatesDirectory = configAggregator.getPropertyValue(
      OrgConfigProperties.ORG_CUSTOM_METADATA_TEMPLATES
    );
    return templatesDirectory ? String(templatesDirectory) : undefined;
  }

  public static async isTelemetryDisabled(): Promise<boolean> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const isTelemetryDisabled = configAggregator.getPropertyValue(
      SF_CONFIG_DISABLE_TELEMETRY
    );
    return isTelemetryDisabled === 'true';
  }

  public static async getDefaultDevHubUsernameOrAlias(): Promise<
    string | undefined
  > {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const defaultDevHubUserName = configAggregator.getPropertyValue(
      TARGET_DEV_HUB_KEY
    );
    return defaultDevHubUserName ? String(defaultDevHubUserName) : undefined;
  }

  public static async getGlobalDefaultDevHubUsernameOrAlias(): Promise<
    string | undefined
  > {
    const globalConfig = await Config.create({ isGlobal: true });
    const defaultGlobalDevHubUserName = globalConfig.get(TARGET_DEV_HUB_KEY);

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

  /**
   * Get the username of the currently auth'd user for the project.
   *
   * @returns The username for the configured Org if it exists.
   */
  public static async getUsername(): Promise<string | undefined> {
    const defaultUsernameOrAlias = await ConfigUtil.getDefaultUsernameOrAlias();
    if (!defaultUsernameOrAlias) {
      return;
    }

    const username = await this.getUsernameFor(defaultUsernameOrAlias);
    return username ? String(username) : undefined;
  }

  /**
   * Get the username of the default dev hub for the project.
   *
   * @returns The username for the configured default dev hub
   * Org if it exists.
   */
  public static async getDevHubUsername(): Promise<string | undefined> {
    const defaultDevHubUsernameOrAlias = await ConfigUtil.getDefaultDevHubUsernameOrAlias();
    if (!defaultDevHubUsernameOrAlias) {
      return;
    }

    const username = await this.getUsernameFor(defaultDevHubUsernameOrAlias);
    return username ? String(username) : undefined;
  }

  /**
   * Get the username of the currently auth'd user for the project
   * given a username or alias.
   *
   * @returns The username for the configured Org if it exists.
   */
  public static async getUsernameFor(usernameOrAlias: string) {
    const info = await StateAggregator.getInstance();
    return info.aliases.getUsername(usernameOrAlias) || usernameOrAlias;
  }

  public static async setDefaultUsernameOrAlias(
    usernameOrAlias: string
  ): Promise<void> {
    const originalDirectory = process.cwd();
    // In order to correctly setup Config, the process directory needs to be set to the current workspace directory
    const workspacePath = workspaceUtils.getRootWorkspacePath();
    try {
      // checks if the usernameOrAlias is non-empty and active.
      if (usernameOrAlias) {
        // throws an error if the org associated with the usernameOrAlias is expired.
        await Org.create({ aliasOrUsername: usernameOrAlias });
      }
      process.chdir(workspacePath);
      await this.setUsernameOrAlias(usernameOrAlias);
    } finally {
      process.chdir(originalDirectory);
    }
  }

  private static async setUsernameOrAlias(usernameOrAlias: string) {
    const config = await Config.create(Config.getDefaultOptions());
    config.set(TARGET_ORG_KEY, usernameOrAlias);
    await config.write();
    // Force the ConfigAggregatorProvider to reload its stored
    // ConfigAggregators so that this config file change is accounted
    // for and the ConfigAggregators are updated with the latest info.
    const configAggregatorProvider = ConfigAggregatorProvider.getInstance();
    await configAggregatorProvider.reloadConfigAggregators();
    // Also force the StateAggregator to reload to have the latest
    // authorization info.
    StateAggregator.clearInstance(workspaceUtils.getRootWorkspacePath());
  }
}
