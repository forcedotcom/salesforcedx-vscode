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
  GlobalInfo
} from '@salesforce/core';
import * as path from 'path';

const defaultUserNameKey = 'defaultusername';

export class ConfigUtil {
  public static async getUsername(
    projectPath: string
  ): Promise<string | undefined> {
    const defaultUserName = (await this.getConfigValue(
      projectPath,
      defaultUserNameKey
    )) as string;
    const info = await GlobalInfo.getInstance();
    const username = info.aliases.resolveValue(defaultUserName);
    // const username = await Aliases.fetch(defaultUserName);
    return username;
  }

  public static async getConfigValue(
    projectPath: string,
    key: string
  ): Promise<ConfigValue | undefined> {
    try {
      const myLocalConfig = await ConfigFile.create({
        isGlobal: false,
        rootFolder: path.join(projectPath, '.sf'),
        filename: 'config.json'
      });
      const localValue = myLocalConfig.get(key);
      if (localValue) {
        return localValue;
      } else {
        const aggregator = await ConfigAggregator.create();
        const globalValue = aggregator.getPropertyValue(key);
        if (globalValue) {
          return globalValue;
        }
      }
    } catch (err) {
      return undefined;
    }
    return undefined;
  }
}
