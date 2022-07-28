/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StateAggregator } from '@salesforce/core';

export class AuthUtil {
  private static instance?: AuthUtil;

  public static getInstance() {
    if (AuthUtil.instance === undefined) {
      AuthUtil.instance = new AuthUtil();
    }
    return AuthUtil.instance;
  }

  public async getUsername(usernameOrAlias: string): Promise<string> {
    const info = await StateAggregator.getInstance();
    return info.aliases.getUsername(usernameOrAlias) || usernameOrAlias;
    // return (await Aliases.fetch(usernameOrAlias)) || usernameOrAlias;
  }
}
