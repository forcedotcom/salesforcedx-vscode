/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo } from '@salesforce/core';
import { ForceConfigGet } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export class OrgAuthInfo {
  public static async getDefaultUsernameOrAlias(
    vscodePath: string
  ): Promise<string | undefined> {
    const forceConfig = await new ForceConfigGet().getConfig(
      vscodePath,
      'defaultusername'
    );
    return forceConfig.get('defaultusername');
  }

  public static async getDefaultDevHubUsernameOrAlias(
    vscodePath: string
  ): Promise<string | undefined> {
    const forceConfig = await new ForceConfigGet().getConfig(
      vscodePath,
      'defaultdevhubusername'
    );
    return forceConfig.get('defaultdevhubusername');
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
