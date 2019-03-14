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
  public static async getDefaultUsernameOrAlias(): Promise<string | undefined> {
    try {
      const rootPath = getRootWorkspacePath();
      const myLocalConfig = await ConfigFile.create({
        isGlobal: false,
        rootFolder: path.join(rootPath, '.sfdx'),
        filename: 'sfdx-config.json'
      });
      const localDefault = myLocalConfig.get('defaultusername');
      return JSON.stringify(localDefault).replace(/\"/g, '');
    } catch {
      await this.getGlobalDefaults('defaultusername');
    }
  }

  private static async getGlobalDefaults(usernameType: string) {
    try {
      const aggregator = await ConfigAggregator.create();
      const globalDefault = aggregator.getPropertyValue(usernameType);
      return JSON.stringify(globalDefault).replace(/\"/g, '');
    } catch {
      console.error('No ' + usernameType + ' found.');
    }
  }

  public static async getDefaultDevHubUsernameOrAlias(): Promise<
    string | undefined
  > {
    try {
      const rootPath = getRootWorkspacePath();
      const myLocalConfig = await ConfigFile.create({
        isGlobal: false,
        rootFolder: path.join(rootPath, '.sfdx'),
        filename: 'sfdx-config.json'
      });
      const localDefault = myLocalConfig.get('defaultdevhubusername');
      return JSON.stringify(localDefault).replace(/\"/g, '');
    } catch {
      await this.getGlobalDefaults('defaultdevhubusername');
    }
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
