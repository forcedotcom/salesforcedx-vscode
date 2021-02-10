/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Aliases } from '@salesforce/core';
import { ConfigUtil } from '..';
import { TelemetryService } from '../telemetry/telemetry';
import { DEFAULT_USERNAME_KEY } from '../types';

export class AuthUtil {
  private static instance?: AuthUtil;

  public static getInstance() {
    if (AuthUtil.instance === undefined) {
      AuthUtil.instance = new AuthUtil();
    }
    return AuthUtil.instance;
  }

  public async getDefaultUsernameOrAlias(
    enableWarning: boolean
  ): Promise<string | undefined> {
    try {
      const defaultUserName = await ConfigUtil.getConfigValue(
        DEFAULT_USERNAME_KEY
      );
      if (defaultUserName === undefined) {
        return undefined;
      }

      return JSON.stringify(defaultUserName).replace(/\"/g, '');
    } catch (err) {
      console.error(err);
      TelemetryService.getInstance().sendException(
        'get_default_username_alias',
        err.message
      );
      return undefined;
    }
  }

  public async getUsername(usernameOrAlias: string): Promise<string> {
    return (await Aliases.fetch(usernameOrAlias)) || usernameOrAlias;
  }
}
