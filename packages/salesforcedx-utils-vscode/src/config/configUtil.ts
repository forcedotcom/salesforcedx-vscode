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
  SfConfigProperties,
  StateAggregator
} from '@salesforce/core';
import { workspaceUtils } from '..';
import { ConfigAggregatorProvider } from '../providers';

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
      SfConfigProperties.DISABLE_TELEMETRY
    );
    return isTelemetryDisabled === 'true';
  }

  public static async getDefaultDevHubUsernameOrAlias(): Promise<
    string | undefined
  > {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const defaultDevHubUserName = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_DEV_HUB
    );
    return defaultDevHubUserName ? String(defaultDevHubUserName) : undefined;
  }

  public static async getGlobalDefaultDevHubUsernameOrAlias(): Promise<
    string | undefined
  > {
    const globalConfig = await Config.create({ isGlobal: true });
    const defaultGlobalDevHubUserName = globalConfig.get(
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

    const username = await getUsernameFor(defaultUsernameOrAlias);
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

    const username = await getUsernameFor(defaultDevHubUsernameOrAlias);
    return username ? String(username) : undefined;
  }

  public static async setDefaultUsernameOrAlias(usernameOrAlias: string): Promise<void> {
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
    config.set(OrgConfigProperties.TARGET_ORG, usernameOrAlias);
    await config.write();
  }

}

async function getUsernameFor(usernameOrAlias: string) {
  const info = await StateAggregator.getInstance();
  const username = usernameOrAlias
    ? info.aliases.getUsername(String(usernameOrAlias))
    : undefined;
  return username ? String(username) : undefined;
}
