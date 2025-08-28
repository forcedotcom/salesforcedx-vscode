/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  AuthRemover,
  AuthInfo,
  AuthFields,
  ConfigAggregator,
  OrgConfigProperties,
  OrgAuthorization,
  Org
} from '@salesforce/core';
import { SfWorkspaceChecker, Table, Column, Row, ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { getAuthFieldsFor } from '../util/orgUtil';

import { OrgListCleanExecutor } from './orgListCleanExecutor';
import { PromptConfirmGatherer, SfCommandlet } from './util';

/** Check actual connection status by testing the connection */
export const determineConnectedStatusForNonScratchOrg = async (username: string): Promise<string | undefined> => {
  let org: Org | undefined;
  try {
    org = await Org.create({ aliasOrUsername: username });

    // Skip connection testing for scratch orgs (they have DEV_HUB_USERNAME)
    if (org.getField(Org.Fields.DEV_HUB_USERNAME)) {
      return undefined;
    }

    await org.refreshAuth();
    return 'Connected';
  } catch (err) {
    return getConnectionStatusFromError(err, org?.getUsername() ?? username);
  }
};

/** Process a single org for potential removal */
const processOrgForRemoval = async (
  orgAuth: OrgAuthorization,
  authRemover: AuthRemover
): Promise<string | undefined> => {
  try {
    // Skip dev hubs
    if (orgAuth.isDevHub) {
      return undefined;
    }

    // Skip orgs with errors - they are likely already invalid
    if (orgAuth.error) {
      channelService.appendLine(
        nls.localize('org_list_clean_skipping_org_with_error', orgAuth.username, orgAuth.error)
      );
      return undefined;
    }

    const authFields: AuthFields = await getAuthFieldsFor(orgAuth.username);

    // Check if this is a scratch org with an expiration date
    if (authFields.expirationDate) {
      const expirationDate = new Date(authFields.expirationDate);

      // Check if org has expired
      if (expirationDate < new Date()) {
        channelService.appendLine(
          nls.localize('org_list_clean_removing_expired_org', orgAuth.username, authFields.expirationDate)
        );
        await authRemover.removeAuth(orgAuth.username);
        return orgAuth.username;
      }
    }
    return undefined;
  } catch (error) {
    // If we can't get auth fields, the org might be deleted/invalid - try to remove it
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (shouldRemoveOrg(error)) {
      try {
        channelService.appendLine(nls.localize('org_list_clean_removing_invalid_org', orgAuth.username, errorMessage));
        await authRemover.removeAuth(orgAuth.username);
        return orgAuth.username;
      } catch (removeError) {
        channelService.appendLine(
          nls.localize(
            'org_list_clean_failed_to_remove_org',
            orgAuth.username,
            removeError instanceof Error ? removeError.message : String(removeError)
          )
        );
        return undefined;
      }
    } else {
      channelService.appendLine(nls.localize('org_list_clean_error_checking_org', orgAuth.username, errorMessage));
      return undefined;
    }
  }
};

/** Remove expired and deleted orgs from local configuration */
export const removeExpiredAndDeletedOrgs = async (): Promise<string[]> => {
  const removedOrgs: string[] = [];

  try {
    const orgAuthorizations = await AuthInfo.listAllAuthorizations();
    if (!orgAuthorizations || orgAuthorizations.length === 0) {
      return removedOrgs;
    }

    const authRemover = await AuthRemover.create();

    // Process each org for potential removal
    for (const orgAuth of orgAuthorizations) {
      const removedUsername = await processOrgForRemoval(orgAuth, authRemover);
      if (removedUsername) {
        removedOrgs.push(removedUsername);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(nls.localize('org_list_clean_general_error', errorMessage));
  }

  return removedOrgs;
};

/** Default org configuration type */
type DefaultOrgConfig = {
  defaultDevHubProperty: string | undefined;
  defaultOrgProperty: string | undefined;
  defaultDevHubUsername: string | undefined;
  defaultOrgUsername: string | undefined;
};

/** Get default org and devhub configuration */
const getDefaultOrgConfiguration = async (): Promise<DefaultOrgConfig> => {
  const configAggregator = await ConfigAggregator.create();
  const defaultDevHubProperty = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_DEV_HUB);
  const defaultOrgProperty = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_ORG);

  return {
    defaultDevHubProperty: String(defaultDevHubProperty),
    defaultOrgProperty: String(defaultOrgProperty),
    defaultDevHubUsername: await ConfigUtil.getUsernameFor(String(defaultDevHubProperty)),
    defaultOrgUsername: await ConfigUtil.getUsernameFor(String(defaultOrgProperty))
  };
};

/** Determine the type of org (DevHub, Sandbox, Org, or Scratch) */
const determineOrgType = (orgAuth: OrgAuthorization, authFields: AuthFields): string => {
  if (orgAuth.isDevHub) {
    return 'DevHub';
  } else if (authFields && !authFields.expirationDate) {
    return authFields.isSandbox ? 'Sandbox' : 'Org';
  }
  return 'Scratch';
};

/** Determine default org markers for display */
const determineOrgMarkers = (orgAuth: OrgAuthorization, alias: string, defaultConfig: DefaultOrgConfig): string => {
  const possibleDefaults = [alias, orgAuth.username].filter(Boolean);

  // Check if this org is the default DevHub (by property value or resolved username)
  const matchesDevHubProperty =
    defaultConfig.defaultDevHubProperty && possibleDefaults.includes(String(defaultConfig.defaultDevHubProperty));
  const matchesDevHubUsername =
    defaultConfig.defaultDevHubUsername && orgAuth.username === defaultConfig.defaultDevHubUsername;
  const isDefaultDevHub = orgAuth.isDevHub && (matchesDevHubProperty ?? matchesDevHubUsername);

  // Check if this org is the default org (by property value or resolved username)
  const matchesOrgProperty =
    defaultConfig.defaultOrgProperty && possibleDefaults.includes(String(defaultConfig.defaultOrgProperty));
  const matchesOrgUsername = defaultConfig.defaultOrgUsername && orgAuth.username === defaultConfig.defaultOrgUsername;
  const isDefaultOrg = matchesOrgProperty ?? matchesOrgUsername;

  if (isDefaultDevHub && isDefaultOrg) {
    return '🌳,🍁';
  } else if (isDefaultDevHub) {
    return '🌳';
  } else if (isDefaultOrg) {
    return '🍁';
  }
  return '';
};

/** Process a single org authorization into display data */
const processOrgForDisplay = async (
  orgAuth: OrgAuthorization,
  defaultConfig: DefaultOrgConfig
): Promise<Row | undefined> => {
  try {
    const authFields: AuthFields = await getAuthFieldsFor(orgAuth.username);

    // Skip non-admin scratch org users
    if (authFields && 'scratchAdminUsername' in authFields) {
      return undefined;
    }

    // Skip scratch orgs parented by other (non-default) devHub orgs
    if (
      authFields &&
      'devHubUsername' in authFields &&
      authFields.devHubUsername !== defaultConfig.defaultDevHubUsername
    ) {
      return undefined;
    }

    // Get org type and aliases
    const orgType = determineOrgType(orgAuth, authFields);
    const aliases = await ConfigUtil.getAllAliasesFor(orgAuth.username);
    const alias = aliases?.length > 0 ? aliases[0] : '';

    // Determine status by actually testing the connection
    let status: string;
    if (authFields.expirationDate) {
      const expirationDate = new Date(authFields.expirationDate);
      if (expirationDate < new Date()) {
        return undefined; // Skip expired orgs (they should have been removed)
      }
      status = 'Active'; // For scratch orgs, we assume they're active if not expired
    } else {
      // For non-scratch orgs, test the actual connection
      const connectedStatus = await determineConnectedStatusForNonScratchOrg(orgAuth.username);
      status = connectedStatus ?? 'Connected';
    }

    // Determine expiration date display
    const expires = authFields.expirationDate ? new Date(authFields.expirationDate).toISOString().split('T')[0] : '';

    // Determine default org markers
    const marker = determineOrgMarkers(orgAuth, alias, defaultConfig);

    return {
      '': marker,
      Type: orgType,
      Alias: alias,
      Username: orgAuth.username,
      'Org Id': authFields.orgId ?? '',
      Status: status,
      Expires: expires
    };
  } catch (error) {
    // Skip orgs that we can't process
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Log error for debugging but continue processing other orgs
    console.warn(`Failed to process org ${orgAuth.username}:`, errorMessage);
    return undefined;
  }
};

/** Create and display the org table */
const createAndDisplayOrgTable = (orgData: Row[]): void => {
  if (orgData.length === 0) {
    channelService.appendLine(`\n${nls.localize('org_list_no_orgs_found')}`);
    return;
  }

  // Create and display the table
  const columns: Column[] = [
    { key: '', label: '' },
    { key: 'Type', label: 'Type' },
    { key: 'Alias', label: 'Alias' },
    { key: 'Username', label: 'Username' },
    { key: 'Org Id', label: 'Org Id' },
    { key: 'Status', label: 'Status' },
    { key: 'Expires', label: 'Expires' }
  ];

  const table = new Table();
  const tableOutput = table.createTable(orgData, columns, '');
  channelService.appendLine(`\n${tableOutput}`);

  // Add legend
  channelService.appendLine('\nLegend:  🌳=Default DevHub, 🍁=Default Org');
};

/** Display remaining orgs in a table format */
export const displayRemainingOrgs = async (): Promise<void> => {
  try {
    const orgAuthorizations = await AuthInfo.listAllAuthorizations();
    if (!orgAuthorizations || orgAuthorizations.length === 0) {
      channelService.appendLine(`\n${nls.localize('org_list_no_orgs_found')}`);
      return;
    }

    // Get default org configuration
    const defaultConfig = await getDefaultOrgConfiguration();

    // Process each org authorization into display data
    const orgData: Row[] = [];
    for (const orgAuth of orgAuthorizations) {
      const orgRow = await processOrgForDisplay(orgAuth, defaultConfig);
      if (orgRow) {
        orgData.push(orgRow);
      }
    }

    // Create and display the table
    createAndDisplayOrgTable(orgData);
  } catch (error) {
    channelService.appendLine(
      `\n${nls.localize('org_list_display_error', error instanceof Error ? error.message : String(error))}`
    );
  }
};

export const orgList = (): void => {
  const parameterGatherer = new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_org_list_clean'));
  const executor = new OrgListCleanExecutor();
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), parameterGatherer, executor);
  void commandlet.run();
};

/** Check if error indicates org should be removed */
export const shouldRemoveOrg = (error: any): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('invalid_login') ||
    message.includes('no such org') ||
    message.includes('namedorgnotfound') ||
    message.includes('noauthinfofound')
  );
};

/** Get connection status from error */
export const getConnectionStatusFromError = (err: any, username?: string): string => {
  const message = err instanceof Error ? err.message : String(err);
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('maintenance')) return 'Down (Maintenance)';
  if (lowerMsg.includes('<html>') || lowerMsg.includes('<!doctype html>')) return 'Bad Response';
  if (
    lowerMsg.includes('expired access/refresh token') ||
    lowerMsg.includes('invalid_session_id') ||
    lowerMsg.includes('bad_oauth_token') ||
    lowerMsg.includes('refreshtokenautherror')
  ) {
    return 'Unable to refresh session: expired access/refresh token';
  }
  if (shouldRemoveOrg(err)) {
    return username ? `Invalid org: ${username}` : 'Invalid org';
  }

  return message;
};
