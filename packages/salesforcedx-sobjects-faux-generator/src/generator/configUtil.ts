/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator, OrgConfigProperties } from '@salesforce/core';

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
  public static async getUsername(projectPath: string): Promise<string | null> {
    const configAggregator = await getConfigAggregator(projectPath);
    const defaultUserNameOrAlias = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_ORG
    );
    return defaultUserNameOrAlias as string;
  }
}
