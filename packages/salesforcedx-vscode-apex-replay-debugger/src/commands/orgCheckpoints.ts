/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Connection } from '@salesforce/core';
import { ApexExecutionOverlayAction } from '../breakpoints/checkpointService';
import { getActiveSalesforceCoreExtension } from '../utils/extensionApis';

const queryCheckpoints = async (conn: Connection): Promise<ReturnType<typeof conn.tooling.query>['records']> => {
  const userId = await getUserIdFromConnection(conn);
  return (await conn.tooling.query(`SELECT Id FROM ApexExecutionOverlayAction WHERE ScopeId = '${userId}'`)).records;
};

/** query the org for checkpoints for the user associated with the connection, then delete them  */
export const clearCheckpoints = async (conn: Connection): Promise<void> => {
  await Promise.all(
    (await queryCheckpoints(conn))
      .map(checkpoint => checkpoint.Id)
      .filter(id => id !== undefined)
      .map(id => conn.tooling.sobject('ApexExecutionOverlayAction').delete(id))
  );
};

export const createCheckpointsInOrg =
  (conn: Connection) =>
  async (checkpoints: ApexExecutionOverlayAction[]): Promise<void> => {
    // jorje LS will put the namespace on the classes (stored in ExecutableEntityName like 'ns/classname') but the org might have been created with --no-namespace
    // if the project has NS, but org does not, we need to rewrite the ExecutableEntityName to remove only that namespace
    // this will need to be modified when checkopint stuff stops using jorje
    const orgNamespace = conn.getAuthInfoFields().namespacePrefix;
    const projectNamespace = (
      await (await getActiveSalesforceCoreExtension()).services.SalesforceProjectConfig.getInstance()
    ).get('namespace');

    const corrected =
      typeof projectNamespace === 'string' && orgNamespace === undefined
        ? checkpoints.map(namespaceCorrector(projectNamespace))
        : checkpoints;
    await Promise.all(corrected.map(c => conn.tooling.sobject('ApexExecutionOverlayAction').create(c)));
  };

const namespaceCorrector =
  (projectNamespace: string) =>
  (cp: ApexExecutionOverlayAction): ApexExecutionOverlayAction => {
    if (cp.ExecutableEntityName?.startsWith(`${projectNamespace}/`)) {
      cp.ExecutableEntityName = cp.ExecutableEntityName.replace(`${projectNamespace}/`, '');
      return cp;
    }
    return cp;
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
