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
  StateAggregator
} from '@salesforce/core';
import * as path from 'path';

export class ConfigUtil {
  public static async getUsername(
    projectPath: string
  ): Promise<string | undefined> {
    const configAggregator = await ConfigUtil.getConfigAggregator(projectPath);
    const defaultUsernameOrAlias = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_ORG
    );

    if (defaultUsernameOrAlias) {
      const info = await StateAggregator.getInstance();
      const username = info.aliases.resolveValue(
        String(defaultUsernameOrAlias)
      );
      return username;
    }
    return undefined;
  }

  // TODO: Consolidate usages of ConfigAggregator - W-11623895
  private static async getConfigAggregator(
    projectPath: string
  ): Promise<ConfigAggregator> {
    const origCurrentWorkingDirectory = process.cwd();
    // Change the current working directory to the project path,
    // so that ConfigAggregator reads the local project values
    process.chdir(projectPath);
    const configAggregator = await ConfigAggregator.create();
    // ConfigAggregator caches instances internally by working directory
    // path.  Clling reload ensures that this instance of ConfigAggregator
    // has the latest values from the config file.
    configAggregator.reload();
    // Change the current working directory back to what it was
    // before returning
    process.chdir(origCurrentWorkingDirectory);
    return configAggregator;
  }
}
