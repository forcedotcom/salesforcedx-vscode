/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, AuthRemover, Org, OrgAuthorization, OrgConfigProperties } from '@salesforce/core';
import { Column, createTable, Row } from '@salesforce/effect-ext-utils';
import { ConfigUtil, SfWorkspaceChecker, SfCommandlet } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import { channelService } from '../channels';
import { AllServicesLayer } from '../extensionProvider';
import { nls } from '../messages';
import { PromptConfirmGatherer } from '../parameterGatherers/promptConfirmGatherer';
import {
  getAuthFieldsFor,
  getConnectionStatusFromError,
  shouldRemoveOrg,
  getConfigAggregatorEffect
} from '../util/orgUtil';
import { OrgListCleanExecutor } from './orgListCleanExecutor';

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
    if (!orgAuthorizations?.length) {
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
  const configAggregator = await Effect.runPromise(getConfigAggregatorEffect.pipe(Effect.provide(AllServicesLayer)));
  const defaultDevHubProperty = configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_DEV_HUB);
  const defaultOrgProperty = configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG);

  return {
    defaultDevHubProperty,
    defaultOrgProperty,
    defaultDevHubUsername: defaultDevHubProperty ? await ConfigUtil.getUsernameFor(defaultDevHubProperty) : undefined,
    defaultOrgUsername: defaultOrgProperty ? await ConfigUtil.getUsernameFor(defaultOrgProperty) : undefined
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
const determineOrgMarkers = (orgAuth: OrgAuthorization, defaultConfig: DefaultOrgConfig): string => {
  const possibleDefaults = new Set([...(orgAuth.aliases ?? []), orgAuth.username].filter(Boolean));

  // Check if this org is the default DevHub (by property value or resolved username)
  const matchesDevHubProperty =
    defaultConfig.defaultDevHubProperty && possibleDefaults.has(String(defaultConfig.defaultDevHubProperty));
  const matchesDevHubUsername =
    defaultConfig.defaultDevHubUsername && orgAuth.username === defaultConfig.defaultDevHubUsername;
  const isDefaultDevHub = orgAuth.isDevHub && (matchesDevHubProperty ?? matchesDevHubUsername);

  // Check if this org is the default org (by property value or resolved username)
  const matchesOrgProperty =
    defaultConfig.defaultOrgProperty && possibleDefaults.has(String(defaultConfig.defaultOrgProperty));
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
    if (orgAuth.isExpired) {
      return undefined;
    }
    const authFields: AuthFields = await getAuthFieldsFor(orgAuth.username);

    // Determine status by actually testing the connection
    const status = authFields.expirationDate
      ? 'Active' // For scratch orgs, we assume they're active if not expired
      : // For non-scratch orgs, test the actual connection
        ((await determineConnectedStatusForNonScratchOrg(orgAuth.username)) ?? 'Connected');
    // Determine expiration date display
    return {
      '': determineOrgMarkers(orgAuth, defaultConfig),
      Type: determineOrgType(orgAuth, authFields),
      Alias: orgAuth.aliases?.[0] ?? '',
      Username: orgAuth.username,
      'Org Id': authFields.orgId ?? '',
      Status: status,
      Expires: authFields.expirationDate ? new Date(authFields.expirationDate).toISOString().split('T')[0] : ''
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

  const tableOutput = createTable(orgData, columns, '');
  channelService.appendLine(`\n${tableOutput}`);

  // Add legend
  channelService.appendLine('\nLegend:  🌳=Default DevHub, 🍁=Default Org');
};

/** Display remaining orgs in a table format */
export const displayRemainingOrgs = async (): Promise<void> => {
  try {
    const orgAuthorizations = await AuthInfo.listAllAuthorizations();
    if (orgAuthorizations?.length === 0) {
      channelService.appendLine(`\n${nls.localize('org_list_no_orgs_found')}`);
      return;
    }

    // Get default org configuration
    const defaultConfig = await getDefaultOrgConfiguration();

    // Process each org authorization into display data
    const orgData = (
      await Promise.all(orgAuthorizations.map(orgAuth => processOrgForDisplay(orgAuth, defaultConfig)))
    ).filter(isNotUndefined);

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
