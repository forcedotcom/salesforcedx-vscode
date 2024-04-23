/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { JsonCollection } from '@salesforce/ts-types';
import { xmlCharMap } from './types';
import type { HttpRequest } from '@jsforce/jsforce-node';

export async function refreshAuth(
  connection: Connection
): Promise<JsonCollection> {
  const requestInfo: HttpRequest = { url: connection.baseUrl(), method: 'GET' };
  return await connection.request(requestInfo);
}

export function escapeXml(data: string): string {
  return data.replace(/[<>&'"]/g, (char) => {
    return xmlCharMap[char];
  });
}
