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
  OrgConfigProperties
} from '@salesforce/core';
import * as path from 'path';

async function getConfigAggregator(
  projectPath: string
): Promise<ConfigAggregator> {
  const origCurrentWorkingDirectory = process.cwd();
  // Change the current working directory to the project path,
  // so that ConfigAggregator reads the local project values
  process.chdir(projectPath);
  const configAggregator = await ConfigAggregator.create();
  // Change the current working directory back to what it was
  // before returning
  process.chdir(origCurrentWorkingDirectory);
  return configAggregator;
}

export class ConfigUtil {
  public static async getUsername(
    projectPath: string
  ): Promise<string | undefined> {
    const configAggregator = await getConfigAggregator(projectPath);
    const defaultUsernameOrAlias = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_ORG
    );
    return (defaultUsernameOrAlias as string) || undefined;
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
