/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Org, StateAggregator, ConfigAggregator } from '@salesforce/core';
import { getConnectionStatusFromError } from '../helpers/utils';
import { messages } from '../i18n/i18n';
import { OrgInfo, OrgQueryResult, ScratchOrgQueryResult, ScratchOrgInfo } from '../types/orgInfo';

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

      return this.getOrgInfoFromConnection(org, connection, authInfo, username);
    } catch (error) {
      // If we can't create a connection, still return org info with error status
      return this.getOrgInfoWithError(username, error);
    }
  }

  private async getOrgInfoFromConnection(
    org: Org,
    connection: Connection,
    authInfo: AuthInfo,
    username: string
  ): Promise<OrgInfo> {
    const authFields = authInfo.getFields(true);

    // Get alias using StateAggregator
    const stateAggregator = await StateAggregator.getInstance();
    const aliases = stateAggregator.aliases.getAll(username);
    const alias = aliases.length > 0 ? aliases[0] : '';

    // Check if this is a scratch org
    const isScratchOrg = Boolean(authFields.devHubUsername);

    // Test connection to determine status
    let connectionStatus = 'Disconnected';
    try {
      await connection.identity();
      connectionStatus = 'Connected';
    } catch (error) {
      connectionStatus = getConnectionStatusFromError(error, username);
    }

    // Get organization details via SOQL
    let orgQuery: OrgQueryResult;
    try {
      orgQuery = await connection.singleRecordQuery<OrgQueryResult>(
        'SELECT Id, Name, CreatedDate, CreatedBy.Username, OrganizationType, InstanceName, IsSandbox FROM Organization'
      );
    } catch (error) {
      // If SOQL query fails, return basic info with error status
      return this.getOrgInfoWithError(username, error);
    }

    // For scratch orgs, get detailed information from the dev hub
    let scratchOrgInfo: ScratchOrgInfo = {
      status: 'Active',
      createdBy: orgQuery.CreatedBy.Username,
      createdDate: orgQuery.CreatedDate,
      expirationDate: '',
      edition: 'Developer',
      orgName: orgQuery.Name
    };

    if (isScratchOrg && authFields.orgId) {
      try {
        const hubOrg = await org.getDevHubOrg();
        if (hubOrg) {
          const hubConnection = hubOrg.getConnection();
          try {
            // Query the dev hub for scratch org information
            const scratchOrgQuery = await hubConnection.singleRecordQuery<ScratchOrgQueryResult>(
              `SELECT Status, CreatedBy.Username, CreatedDate, ExpirationDate, Edition, OrgName FROM ScratchOrgInfo WHERE ScratchOrg = '${authFields.orgId.substring(
                0,
                15
              )}'`
            );

            scratchOrgInfo = {
              status: scratchOrgQuery.Status,
              createdBy: scratchOrgQuery.CreatedBy.Username,
              createdDate: scratchOrgQuery.CreatedDate,
              expirationDate: scratchOrgQuery.ExpirationDate,
              edition: scratchOrgQuery.Edition,
              orgName: scratchOrgQuery.OrgName,
              password: authFields.password ?? ''
            };
          } catch {
            // If dev hub query fails, fall back to basic info with connection status as error
            scratchOrgInfo.status = connectionStatus;
          }
        }
      } catch {
        // If we can't get scratch org info, fall back to basic info
        scratchOrgInfo.expirationDate = authFields.expirationDate ?? '';
      }
    }

    // Determine org type and status
    let edition = scratchOrgInfo.edition;
    const status = scratchOrgInfo.status;

    if (!isScratchOrg) {
      if (orgQuery.IsSandbox) {
        edition = 'Sandbox';
      } else if (orgQuery.OrganizationType === 'Enterprise') {
        edition = 'Enterprise';
      } else if (orgQuery.OrganizationType === 'Professional') {
        edition = 'Professional';
      }
    }

    const orgInfo: OrgInfo = {
      username,
      devHubId: authFields.devHubUsername ?? '',
      id: authFields.orgId ?? orgQuery.Id,
      createdBy: scratchOrgInfo.createdBy,
      createdDate: scratchOrgInfo.createdDate,
      expirationDate: scratchOrgInfo.expirationDate,
      status,
      edition,
      orgName: scratchOrgInfo.orgName,
      accessToken: authFields.accessToken ?? '',
      instanceUrl: authFields.instanceUrl ?? '',
      clientId: authFields.clientId ?? '',
      apiVersion: authFields.instanceApiVersion ?? '',
      alias,
      connectionStatus,
      password: scratchOrgInfo.password ?? ''
    };

    return orgInfo;
  }

  /** Get org info with error status when connection fails */
  private async getOrgInfoWithError(username: string, error: any): Promise<OrgInfo> {
    const connectionStatus = getConnectionStatusFromError(error, username);

    // Try to get basic auth info without creating a connection
    let authFields: any = {};
    let alias = '';

    try {
      const authInfo = await AuthInfo.create({ username });
      authFields = authInfo.getFields(true);

      // Get alias using StateAggregator
      const stateAggregator = await StateAggregator.getInstance();
      const aliases = stateAggregator.aliases.getAll(username);
      alias = aliases.length > 0 ? aliases[0] : '';
    } catch {
      // If we can't even get auth info, use minimal info
    }

    // Return basic org info with error status
    const orgInfo: OrgInfo = {
      username,
      devHubId: authFields && typeof authFields.devHubUsername === 'string' ? authFields.devHubUsername : '',
      id: authFields && typeof authFields.orgId === 'string' ? authFields.orgId : '',
      createdBy: '',
      createdDate: '',
      expirationDate: authFields && typeof authFields.expirationDate === 'string' ? authFields.expirationDate : '',
      status: connectionStatus, // Show the error in the status field
      edition: '',
      orgName: '',
      accessToken: authFields && typeof authFields.accessToken === 'string' ? authFields.accessToken : '',
      instanceUrl: authFields && typeof authFields.instanceUrl === 'string' ? authFields.instanceUrl : '',
      clientId: authFields && typeof authFields.clientId === 'string' ? authFields.clientId : '',
      apiVersion: authFields && typeof authFields.instanceApiVersion === 'string' ? authFields.instanceApiVersion : '',
      alias,
      connectionStatus,
      password: ''
    };

    return orgInfo;
  }
}
