/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, ConfigAggregator, OrgConfigProperties, StateAggregator } from '@salesforce/core';
import { SF_CONFIG_DISABLE_TELEMETRY } from '../constants';
import { ConfigAggregatorProvider } from '../providers/configAggregatorProvider';
import { TelemetryService } from '../services/telemetry';

export enum ConfigSource {
  Local,
  Global,
  None
}

const getConfigSource = async (key: string): Promise<ConfigSource> => {
  const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
  const configSource = configAggregator.getLocation(key);
  switch (configSource) {
    case ConfigAggregator.Location.LOCAL:
      return ConfigSource.Local;
    case ConfigAggregator.Location.GLOBAL:
      return ConfigSource.Global;
    default:
      return ConfigSource.None;
  }
};

export class ConfigUtil {
  /*
   * The User-configured API version is set by the user, and is used to
   * override the API version that is otherwise gotten from the authenticated
   * Org in some cases, such as when deploying metadata.
   */
  public static async getUserConfiguredApiVersion(): Promise<string | undefined> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const apiVersion = configAggregator.getPropertyValue(OrgConfigProperties.ORG_API_VERSION);
    return apiVersion ? String(apiVersion) : undefined;
  }

  public static async getTargetOrgOrAlias(): Promise<string | undefined> {
    try {
      const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
      const targetOrgOrAlias = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_ORG);
      if (!targetOrgOrAlias) {
        return undefined;
      }

      return JSON.stringify(targetOrgOrAlias).replace(/"/g, '');
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        TelemetryService.getInstance().sendException('get_target_org_alias', err.message);
      }
      throw err;
    }
  }

  public static async isGlobalTargetOrg(): Promise<boolean> {
    const configSource: ConfigSource = await getConfigSource(OrgConfigProperties.TARGET_ORG);
    return configSource === ConfigSource.Global;
  }

  public static async getTemplatesDirectory(): Promise<string | undefined> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const templatesDirectory = configAggregator.getPropertyValue(OrgConfigProperties.ORG_CUSTOM_METADATA_TEMPLATES);
    return templatesDirectory ? String(templatesDirectory) : undefined;
  }

  public static async isTelemetryDisabled(): Promise<boolean> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const isTelemetryDisabled = configAggregator.getPropertyValue(SF_CONFIG_DISABLE_TELEMETRY);
    return isTelemetryDisabled === 'true';
  }

  public static async getTargetDevHubOrAlias(): Promise<string | undefined> {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    const targetDevHub = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_DEV_HUB);
    return targetDevHub ? String(targetDevHub) : undefined;
  }

  public static async getGlobalTargetDevHubOrAlias(): Promise<string | undefined> {
    const globalConfig = await Config.create({ isGlobal: true });
    const globalTargetDevHub = globalConfig.get(OrgConfigProperties.TARGET_DEV_HUB);

    return globalTargetDevHub ? String(globalTargetDevHub) : undefined;
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
    const targetOrgOrAlias = await ConfigUtil.getTargetOrgOrAlias();
    if (!targetOrgOrAlias) {
      return;
    }

    const username = await this.getUsernameFor(targetOrgOrAlias);
    return username ? String(username) : undefined;
  }

  /**
   * Get the username of the target dev hub for the project.
   *
   * @returns The username for the configured target dev hub
   * Org if it exists.
   */
  public static async getDevHubUsername(): Promise<string | undefined> {
    const targetDevHubOrAlias = await ConfigUtil.getTargetDevHubOrAlias();
    if (!targetDevHubOrAlias) {
      return;
    }

    const username = await this.getUsernameFor(targetDevHubOrAlias);
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
    return info.aliases.getUsername(usernameOrAlias) ?? usernameOrAlias;
  }
}
