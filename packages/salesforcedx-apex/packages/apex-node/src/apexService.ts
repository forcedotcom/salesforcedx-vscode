/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ApexExecute } from './commands';
import { nls } from './i18n';
import { ApexExecuteOptions, ExecuteAnonymousResponse } from './types';
import { ApexLogGet } from './commands/apexLogGet';
import { ApexLogGetOptions } from './types/service';

export class ApexService {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async apexExecute(
    options: ApexExecuteOptions
  ): Promise<ExecuteAnonymousResponse> {
    try {
      const apexExecute = new ApexExecute(this.connection);
      const result = await apexExecute.execute(options);
      return result;
    } catch (e) {
      throw new Error(
        nls.localize('unexpected_execute_command_error', e.message)
      );
    }
  }

  public async refreshAuth(connection: Connection) {
    const requestInfo = { url: connection.baseUrl(), method: 'GET' };
    return await connection.request(requestInfo);
  }

  public async apexLogGet(options: ApexLogGetOptions): Promise<string[]> {
    try {
      const apexLogGet = new ApexLogGet(this.connection);
      const result = await apexLogGet.execute(options);
      return result;
    } catch (e) {
      throw new Error(
        nls.localize('unexpected_log_get_command_error', e.message)
      );
    }
  }
}
