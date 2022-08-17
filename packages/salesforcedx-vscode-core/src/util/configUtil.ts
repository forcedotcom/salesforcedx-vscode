/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigAggregator,
  ConfigFile,
  ConfigValue,
  OrgConfigProperties,
  SfConfigProperties,
  SfdxConfigAggregator,
  SfdxPropertyKeys
} from '@salesforce/core';
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as path from 'path';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from './index';

export enum ConfigSource {
  Local,
  Global,
  None
}

async function getConfigAggregator(): Promise<ConfigAggregator> {
  const origCurrentWorkingDirectory = process.cwd();
  const rootWorkspacePath = getRootWorkspacePath();
  // Change the current working directory to the project path,
  // so that ConfigAggregator reads the local project values
  process.chdir(rootWorkspacePath);
  const configAggregator = await ConfigAggregator.create();
  // Change the current working directory back to what it was
  // before returning
  process.chdir(origCurrentWorkingDirectory);
  return configAggregator;
}

// The SfdxConfigAggregator is used only to get configuration
// values that correspond with old/deprecated config keys.
// Currently, the key used for the custom templates
// directory is the only usage, since it is documented for use
// here: https://developer.salesforce.com/tools/vscode/en/user-guide/byotemplate#set-default-template-location
async function getSfdxConfigAggregator(): Promise<ConfigAggregator> {
  const origCurrentWorkingDirectory = process.cwd();
  const rootWorkspacePath = getRootWorkspacePath();
  // Change the current working directory to the project path,
  // so that ConfigAggregator reads the local project values
  process.chdir(rootWorkspacePath);
  const configAggregator = await SfdxConfigAggregator.create();
  // Change the current working directory back to what it was
  // before returning
  process.chdir(origCurrentWorkingDirectory);
  return configAggregator;
}

export class ConfigUtil {
  public static async getConfigSource(
    key: string
  ): Promise<ConfigSource.Local | ConfigSource.Global | ConfigSource.None> {
    const configAggregator = await getConfigAggregator();
    const configSource = configAggregator.getLocation(key);
    if (configSource === ConfigAggregator.Location.LOCAL) {
      return ConfigSource.Local;
    }
    if (configSource === ConfigAggregator.Location.GLOBAL) {
      return ConfigSource.Global;
    }
    return ConfigSource.None;
  }

  public static async getConfigValue(
    key: string,
    source?: ConfigSource.Global | ConfigSource.Local
  ): Promise<ConfigValue | undefined> {
    if (source === undefined || source === ConfigSource.Local) {
      try {
        const rootPath = getRootWorkspacePath();
        const myLocalConfig = await ConfigFile.create({
          isGlobal: false,
          rootFolder: path.join(rootPath, '.sfdx'),
          filename: 'sfdx-config.json'
        });
        const localValue = myLocalConfig.get(key);
        if (!isNullOrUndefined(localValue)) {
          return localValue;
        }
      } catch (err) {
        telemetryService.sendException('get_config_value_local', err.message);
        return undefined;
      }
    }
    if (source === undefined || source === ConfigSource.Global) {
      try {
        const aggregator = await ConfigAggregator.create();
        const globalValue = aggregator.getPropertyValue(key);
        if (!isNullOrUndefined(globalValue)) {
          return globalValue;
        }
      } catch (err) {
        telemetryService.sendException('get_config_value_global', err.message);
        return undefined;
      }
    }
    return undefined;
  }

  public static async getUserConfiguredApiVersion(): Promise<
    string | undefined
  > {
    const apiVersion = await ConfigUtil.getConfigValue('apiVersion');
    return apiVersion ? String(apiVersion) : undefined;
  }

  public static async getDefaultUsernameOrAlias(): Promise<string | undefined> {
    const configAggregator = await getConfigAggregator();
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

  public static async getTemplatesDirectory(): Promise<string | undefined> {
    const sfdxConfigAggregator = await getSfdxConfigAggregator();
    const templatesDirectory = sfdxConfigAggregator.getPropertyValue(
      SfdxPropertyKeys.CUSTOM_ORG_METADATA_TEMPLATES
    );
    return (templatesDirectory as string) || undefined;
  }

  public static async isTelemetryDisabled(): Promise<string> {
    const configAggregator = await getConfigAggregator();
    const isTelemetryDisabled = await configAggregator.getPropertyValue(
      SfConfigProperties.DISABLE_TELEMETRY
    );
    return String(isTelemetryDisabled);
  }
}
