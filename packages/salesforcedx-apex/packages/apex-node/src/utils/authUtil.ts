/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { JsonCollection } from '@salesforce/ts-types';

export async function refreshAuth(
  connection: Connection
): Promise<JsonCollection> {
  const requestInfo = { url: connection.baseUrl(), method: 'GET' };
  return await connection.request(requestInfo);
}
