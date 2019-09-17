/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Aliases,
  ConfigAggregator,
  ConfigFile,
  ConfigValue
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
    const username = await Aliases.fetch(defaultUserName);
    return Promise.resolve(username);
  }

  public static async getConfigValue(
    projectPath: string,
    key: string
  ): Promise<ConfigValue | undefined> {
    try {
      const myLocalConfig = await ConfigFile.create({
        isGlobal: false,
        rootFolder: path.join(projectPath, '.sfdx'),
        filename: 'sfdx-config.json'
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
