/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator, ConfigFile, ConfigValue } from '@salesforce/core';
import * as path from 'path';
import { TelemetryService } from '../telemetry/telemetry';
import { getRootWorkspacePath } from '../workspaces';

export enum ConfigSource {
  Local,
  Global,
  None
}

// This class should be reworked or removed once the ConfigAggregator correctly checks
// local as well as global configs. It's also worth noting that ConfigAggregator, according
// to its docs checks local, global and environment and, for our purposes, environment may
// not be viable.

export class ConfigUtil {
  public static async getConfigSource(key: string): Promise<ConfigSource> {
    let value = await ConfigUtil.getConfigValue(key, ConfigSource.Local);
    if (!(value === null || value === undefined)) {
      return ConfigSource.Local;
    }
    value = await ConfigUtil.getConfigValue(key, ConfigSource.Global);
    if (!(value === null || value === undefined)) {
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
        if (!(localValue === null || localValue === undefined)) {
          return localValue;
        }
      } catch (err) {
        await TelemetryService.getInstance().sendException(
          'get_config_value_local',
          err.message
        );
        return undefined;
      }
    }
    if (source === undefined || source === ConfigSource.Global) {
      try {
        const aggregator = await ConfigAggregator.create();
        const globalValue = aggregator.getPropertyValue(key);
        if (!(globalValue === null || globalValue === undefined)) {
          return globalValue;
        }
      } catch (err) {
        await TelemetryService.getInstance().sendException(
          'get_config_value_global',
          err.message
        );
        return undefined;
      }
    }
    return undefined;
  }
}
