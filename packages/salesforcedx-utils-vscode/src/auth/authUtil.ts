/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StateAggregator } from '@salesforce/core';
import { ConfigUtil } from '..';
import { TelemetryService } from '../telemetry/telemetry';

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
      const defaultUserName = await ConfigUtil.getDefaultUsernameOrAlias();
      if (defaultUserName === undefined) {
        return undefined;
      }

      return JSON.stringify(defaultUserName).replace(/\"/g, '');
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        TelemetryService.getInstance().sendException(
          'get_default_username_alias',
          err.message
        );
      }
      return undefined;
    }
  }

  public async getUsername(usernameOrAlias: string): Promise<string> {
    const info = await StateAggregator.getInstance();
    return info.aliases.getUsername(usernameOrAlias) || usernameOrAlias;
  }
}
