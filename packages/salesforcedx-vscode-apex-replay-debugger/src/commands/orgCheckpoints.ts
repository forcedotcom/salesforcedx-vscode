/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ApexExecutionOverlayAction } from '../breakpoints/checkpointService';

const queryCheckpoints = async (conn: Connection): Promise<ReturnType<typeof conn.tooling.query>['records']> => {
  const userId = await getUserIdFromConnection(conn);
  return (await conn.tooling.query(`SELECT Id FROM ApexExecutionOverlayAction WHERE ScopeId = '${userId}'`)).records;
};

/** query the org for checkpoints for the user associated with the connection, then delete them  */
export const clearCheckpoints = async (conn: Connection): Promise<void> => {
  const checkpointsIds = (await queryCheckpoints(conn)).map(checkpoint => checkpoint.Id).filter(id => id !== undefined);
  if (checkpointsIds.length > 0) {
    await conn.tooling.sobject('ApexExecutionOverlayAction').delete(checkpointsIds);
  }
};

export const createCheckpointsInOrg =
  (conn: Connection) =>
  async (checkpoints: ApexExecutionOverlayAction[]): Promise<void> => {
    await conn.tooling.sobject('ApexExecutionOverlayAction').create(checkpoints);
  };

// cache userId by username
const userIdCache = new Map<string, string>();

const getUserIdFromConnection = async (conn: Connection): Promise<string> => {
  const username = conn.getUsername();
  if (username && userIdCache.has(username)) {
    return userIdCache.get(username)!;
  }
  const userId = conn.getAuthInfoFields().userId ?? (await conn.identity()).user_id;
  return userId;
};
