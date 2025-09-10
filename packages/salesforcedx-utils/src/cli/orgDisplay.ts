/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, Connection, Org, StateAggregator, ConfigAggregator } from '@salesforce/core';
import { getConnectionStatusFromError } from '../helpers/utils';
import { messages } from '../i18n/i18n';
import { OrgInfo, OrgQueryResult, ScratchOrgQueryResult } from '../types/orgInfo';

export class OrgDisplay {
  private username?: string;

  constructor(username?: string) {
    this.username = username;
  }

  public async getUsername(salesforceProject?: string): Promise<string> {
    let usernameOrAlias: string | undefined;

    if (this.username) {
      return this.username;
    }

    // Try to get username from project config
    try {
      const configAggregator: ConfigAggregator = await ConfigAggregator.create({
        projectPath: salesforceProject
      });
      const configUsernameOrAlias = configAggregator.getPropertyValue<string>('target-org');
      if (configUsernameOrAlias && typeof configUsernameOrAlias === 'string') {
        usernameOrAlias = configUsernameOrAlias;
      }
    } catch {
      // Ignore config errors
    }

    if (!usernameOrAlias) {
      throw new Error(messages.no_username_provided);
    }

    // Resolve alias to actual username if needed
    try {
      const stateAggregator = await StateAggregator.getInstance();
      const actualUsername = stateAggregator.aliases.getUsername(usernameOrAlias) ?? usernameOrAlias;
      return actualUsername;
    } catch {
      // If we can't resolve, return what we have
      return usernameOrAlias;
    }
  }

  public async getOrgInfo(salesforceProject?: string): Promise<OrgInfo> {
    const username = await this.getUsername(salesforceProject);

    try {
      const authInfo = await AuthInfo.create({ username });
      const connection = await Connection.create({ authInfo });
      const org = await Org.create({ connection });

      return getOrgInfoFromConnection(org, connection, authInfo, username);
    } catch (error) {
      // If we can't create a connection, still return org info with error status
      return getOrgInfoWithError(username, error);
    }
  }
}

/** Create OrgInfo object with common fields and fallback values full of empty strings */
const createOrgInfo = (
  username: string,
  authFields: AuthFields | undefined,
  alias: string | undefined,
  connectionStatus: string,
  overrides: Partial<OrgInfo> = {}
): OrgInfo => ({
  username,
  devHubId: authFields?.devHubUsername ?? '',
  id: authFields?.orgId ?? '',
  createdBy: '',
  createdDate: '',
  expirationDate: authFields?.expirationDate ?? '',
  edition: '',
  orgName: '',
  accessToken: authFields?.accessToken ?? '',
  instanceUrl: authFields?.instanceUrl ?? '',
  clientId: authFields?.clientId ?? '',
  apiVersion: authFields?.instanceApiVersion ?? '',
  alias: alias ?? '',
  connectionStatus,
  password: '',
  status: connectionStatus,
  ...overrides
});

/** Get org info from an established connection */
const getOrgInfoFromConnection = async (
  org: Org,
  connection: Connection,
  authInfo: AuthInfo,
  username: string
): Promise<OrgInfo> => {
  const authFields = authInfo.getFields(true);
  const alias = await getFirstAlias(username);

  // Check if this is a scratch org
  const isScratchOrg = Boolean(authFields.devHubUsername);

  // Get organization details via SOQL
  let orgQuery: OrgQueryResult;
  try {
    orgQuery = await connection.singleRecordQuery<OrgQueryResult>(
      'SELECT Id, Name, CreatedDate, CreatedBy.Username, OrganizationType, InstanceName, NamespacePrefix, IsSandbox FROM Organization'
    );
  } catch (error) {
    // If SOQL query fails, return basic info with error status
    return getOrgInfoWithError(username, error);
  }

  const scratchOrgQuery = isScratchOrg && authFields.orgId ? await queryScratchOrg(org, authFields.orgId) : undefined;
  const connectionStatus = await getConnectionStatus(connection, username);

  // scratch org query results, when present, are preferred over org query results
  return createOrgInfo(username, authFields, alias, connectionStatus, {
    id: authFields.orgId ?? orgQuery.Id,
    createdBy: scratchOrgQuery?.CreatedBy.Username ?? orgQuery.CreatedBy.Username,
    createdDate: scratchOrgQuery?.CreatedDate ?? orgQuery.CreatedDate,
    expirationDate: scratchOrgQuery?.ExpirationDate ?? authFields.expirationDate ?? '',
    edition: scratchOrgQuery?.Edition ?? getEdition(orgQuery),
    orgName: scratchOrgQuery?.OrgName ?? orgQuery.Name,
    ...(authFields.password ? { password: authFields.password } : {}),
    status: scratchOrgQuery?.Status ?? (await getConnectionStatus(connection, username))
  });
};

const getEdition = (orgQuery: OrgQueryResult): string => {
  if (orgQuery.IsSandbox) {
    return 'Sandbox';
  } else if (orgQuery.OrganizationType === 'Enterprise') {
    return 'Enterprise';
  } else if (orgQuery.OrganizationType === 'Professional') {
    return 'Professional';
  }
  return 'Developer';
};

const queryScratchOrg = async (org: Org, orgId: string): Promise<ScratchOrgQueryResult | undefined> => {
  const hubOrg = await org.getDevHubOrg();
  if (!hubOrg) {
    return undefined;
  }
  const hubConnection = hubOrg.getConnection();
  try {
    // Query the dev hub for scratch org information
    return await hubConnection.singleRecordQuery<ScratchOrgQueryResult>(
      `SELECT Status, CreatedBy.Username, CreatedDate, ExpirationDate, Edition, OrgName FROM ScratchOrgInfo WHERE ScratchOrg = '${orgId.substring(
        0,
        15
      )}'`
    );
  } catch {
    return undefined;
  }
};
/** Get org info with error status when connection fails */
const getOrgInfoWithError = async (username: string, error: any): Promise<OrgInfo> => {
  const connectionStatus = getConnectionStatusFromError(error, username);

  // Try to get basic auth info without creating a connection

  try {
    const [authInfo, alias] = await Promise.all([AuthInfo.create({ username }), getFirstAlias(username)]);

    // Get alias using StateAggregator
    return createOrgInfo(username, authInfo.getFields(true), alias, connectionStatus);
  } catch {
    // If we can't even get auth info, use minimal info
    // Return basic org info with error status
    return createOrgInfo(username, undefined, '', connectionStatus);
  }
};

const getFirstAlias = async (username: string): Promise<string | undefined> =>
  (await StateAggregator.getInstance()).aliases.getAll(username)?.[0];

/** Test connection to determine status */
const getConnectionStatus = async (conn: Connection, username: string): Promise<string> => {
  try {
    await conn.identity();
    return 'Connected';
  } catch (error) {
    return getConnectionStatusFromError(error, username);
  }
};
