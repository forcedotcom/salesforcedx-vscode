/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Aliases,
  AuthInfo,
  ConfigAggregator,
  ConfigFile
} from '@salesforce/core';
import * as path from 'path';
import { getRootWorkspacePath, hasRootWorkspace } from './index';
export class OrgAuthInfo {
  public static async getDefaultUsernameOrAlias(
    vscodePath: string
  ): Promise<string | undefined> {
    if (hasRootWorkspace()) {
      const rootPath = path.join(getRootWorkspacePath(), '/');
      const myLocalConfig = await ConfigFile.create({
        isGlobal: false,
        rootFolder: path.join(rootPath, '.sfdx'),
        filename: 'sfdx-config.json'
      });
      const localDefault = myLocalConfig.get('defaultusername');
      return JSON.stringify(localDefault).replace(/\"/g, '');
    }

    const aggregator = await ConfigAggregator.create();
    const globalDefault = aggregator.getPropertyValue('defaultusername');
    return JSON.stringify(globalDefault).replace(/\"/g, '');
  }

  public static async getDefaultDevHubUsernameOrAlias(): Promise<
    string | undefined
  > {
    if (hasRootWorkspace()) {
      const rootPath = path.join(getRootWorkspacePath(), '/');
      const myLocalConfig = await ConfigFile.create({
        isGlobal: false,
        rootFolder: path.join(rootPath + '.sfdx'),
        filename: 'sfdx-config.json'
      });
      const localDefault = myLocalConfig.get('defaultdevhubusername');
      return JSON.stringify(localDefault).replace(/\"/g, '');
    }

    const aggregator = await ConfigAggregator.create();
    const globalDefault = aggregator.getPropertyValue('defaultdevhubusername');
    return JSON.stringify(globalDefault).replace(/\"/g, '');
  }

  public static async getUsername(usernameOrAlias: string): Promise<string> {
    const username = await Aliases.fetch(usernameOrAlias);
    if (username) {
      return Promise.resolve(username);
    }
    return Promise.resolve(usernameOrAlias);
  }

  public static async isAScratchOrg(username: string): Promise<boolean> {
    try {
      const authInfo = await AuthInfo.create({ username });
      const authInfoFields = authInfo.getFields();
      return Promise.resolve(
        typeof authInfoFields.devHubUsername !== 'undefined'
      );
    } catch (e) {
      throw e;
    }
  }
}
