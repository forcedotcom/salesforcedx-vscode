/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  AuthFields,
  AuthInfo,
  AuthRemover,
  Org,
  OrgAuthorization,
  OrgConfigProperties,
  Config
} from '@salesforce/core';
import { Column, createTable, Row, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  notificationService,
  workspaceUtils,
  ConfigAggregatorProvider
} from '@salesforce/salesforcedx-utils-vscode';
import { ICONS } from '@salesforce/vscode-services';
import { Effect, Stream, SubscriptionRef } from 'effect';
import * as Chunk from 'effect/Chunk';
import * as Option from 'effect/Option';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { getOrgRuntime } from '../extensionProvider';
import { nls } from '../messages';
import { getConfigAggregatorEffect } from './configAggregatorEffect';

const DAYS_BEFORE_EXPIRE = 5;

const orgExpiresSoon = (authFields: AuthFields) =>
  isString(authFields.expirationDate) &&
  new Date(authFields.expirationDate) <= new Date(Date.now() + DAYS_BEFORE_EXPIRE * 24 * 60 * 60 * 1000);

const orgIsExpired = (authFields: AuthFields) =>
  isString(authFields.expirationDate) && new Date(authFields.expirationDate) < new Date();

/** One time notification about orgs that expire soon */
export const checkForSoonToBeExpiredOrgs = Effect.fn('OrgUtil.checkForSoonToBeExpiredOrgs')(function* () {
  const daysUntilExpiration = new Date();
  daysUntilExpiration.setDate(daysUntilExpiration.getDate() + DAYS_BEFORE_EXPIRE);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const defaultOrgRef = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  const results = yield* Stream.fromIterable(yield* Effect.promise(() => AuthInfo.listAllAuthorizations())).pipe(
    // only scratch org can expire
    Stream.filter(o => Boolean(o.isScratchOrg)),
    Stream.mapEffect(o => Effect.promise(() => getAuthFieldsFor(o.username))),
    Stream.tap(o =>
      // special warning about when default orgs expire
      defaultOrgRef.username && o.username === defaultOrgRef.username && orgIsExpired(o)
        ? Effect.sync(() => void notificationService.showWarningMessage(nls.localize('default_org_expired')))
        : Effect.void
    ),
    // Filter out the expired orgs.
    Stream.filter(o => !orgIsExpired(o)),
    Stream.filter(orgExpiresSoon),
    // TODO: type guards or some Schema based check instead of !
    Stream.map(o =>
      nls.localize('pending_org_expiration_expires_on_message', o.alias ?? o.username!, o.expirationDate!)
    ),
    Stream.runCollect
  );

  if (results.length === 0) {
    return;
  }

  notificationService.showWarningMessage(
    nls.localize('pending_org_expiration_notification_message', DAYS_BEFORE_EXPIRE)
  );

  channelService.appendLine(
    nls.localize(
      'pending_org_expiration_output_channel_message',
      DAYS_BEFORE_EXPIRE,
      Chunk.toArray(results).join('\n\n')
    )
  );
  channelService.showChannelOutput();
});

export const getAuthFieldsFor = async (username: string): Promise<AuthFields> => {
  const authInfo: AuthInfo = await AuthInfo.create({
    username
  });

  return authInfo.getFields();
};

export const updateConfigAndStateAggregators = async (): Promise<void> => {
  const { StateAggregator } = await import('@salesforce/core');

  // Force the ConfigAggregatorProvider to reload its stored
  // ConfigAggregators so that this config file change is accounted
  // for and the ConfigAggregators are updated with the latest info.
  const configAggregatorProvider = ConfigAggregatorProvider.getInstance();
  await configAggregatorProvider.reloadConfigAggregators();
  // Also force the StateAggregator to reload to have the latest
  // authorization info. Called without args to clear ALL cached instances,
  // including the default one used by AuthInfo.listAllAuthorizations().
  await StateAggregator.clearInstanceAsync();

  // Trigger Apex Test Controller to discover tests after org auth/set-default. Delay so config
  // and TargetOrgRef can propagate before refresh runs.
  const REFRESH_DELAY_MS = 800;
  setTimeout(() => {
    void vscode.commands.executeCommand('sf.apex.test.refresh');
  }, REFRESH_DELAY_MS);
};

const setUsernameOrAlias = async (usernameOrAlias: string): Promise<void> => {
  const config = await Config.create(Config.getDefaultOptions());
  config.set(OrgConfigProperties.TARGET_ORG, usernameOrAlias);
  await config.write();
  await updateConfigAndStateAggregators();
};

/** Sets the target org or alias in the local config */
export const setTargetOrgOrAlias = async (usernameOrAlias: string): Promise<void> => {
  const originalDirectory = process.cwd();
  // In order to correctly setup Config, the process directory needs to be set to the current workspace directory
  const workspacePath = workspaceUtils.getRootWorkspacePath();
  try {
    process.chdir(workspacePath);
    // checks if the usernameOrAlias is non-empty and active.
    if (usernameOrAlias) {
      // throws an error if the org associated with the usernameOrAlias is expired.
      await Org.create({ aliasOrUsername: usernameOrAlias });
    }
    await setUsernameOrAlias(usernameOrAlias);
  } finally {
    process.chdir(originalDirectory);
  }
};

/** Get connection status from error */
export const getConnectionStatusFromError = (err: any, username?: string): string => {
  const message = err instanceof Error ? err.message : String(err);
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('maintenance')) return 'Down (Maintenance)';
  if (lowerMsg.includes('<html>') || lowerMsg.includes('<!doctype html>')) return 'Bad Response';
  if (
    ['expired access/refresh token', 'invalid_session_id', 'bad_oauth_token', 'refreshtokenautherror'].some(token =>
      lowerMsg.includes(token)
    )
  ) {
    return 'Unable to refresh session: expired access/refresh token';
  }
  if (shouldRemoveOrg(err)) {
    return username ? `Invalid org: ${username}` : 'Invalid org';
  }

  return message;
};

/** Check if org should be removed based on error */
export const shouldRemoveOrg = (err: any): boolean => {
  const lowerMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return ['invalid_login', 'no such org', 'namedorgnotfound', 'noauthinfofound'].some(msg => lowerMsg.includes(msg));
};

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

const resolveUsernameFromAliasEffect = (aliasOrUsername: string) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const aliasService = yield* api.services.AliasService;
    const opt = yield* aliasService.getUsernameFromAlias(aliasOrUsername);
    return Option.getOrElse(opt, () => aliasOrUsername);
  });

const readAliasesByUsernameFromDiskEffect = () =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const aliasService = yield* api.services.AliasService;
    const orgs = yield* aliasService.getAllAliases();
    const result = new Map<string, string[]>();
    for (const [alias, username] of Object.entries(orgs)) {
      const existing = result.get(username) ?? [];
      existing.push(alias);
      result.set(username, existing);
    }
    return result;
  });

/**
 * Returns the resolved username for a given alias, or the input if it is already a username.
 * Uses AliasService (reads alias.json via FsService, bypassing StateAggregator cache).
 */
export const resolveUsernameFromAlias = async (aliasOrUsername: string): Promise<string> =>
  getOrgRuntime().runPromise(resolveUsernameFromAliasEffect(aliasOrUsername));

/**
 * Returns a map of username → aliases[]. Used to supplement stale StateAggregator data in the org picker.
 * Uses AliasService (reads alias.json via FsService, bypassing StateAggregator cache).
 */
export const readAliasesByUsernameFromDisk = async (): Promise<Map<string, string[]>> =>
  getOrgRuntime().runPromise(readAliasesByUsernameFromDiskEffect());

/** Get default org and devhub configuration */
export const getDefaultOrgConfiguration = async (): Promise<DefaultOrgConfig> => {
  const configAggregator = await getOrgRuntime().runPromise(getConfigAggregatorEffect);
  const defaultDevHubProperty = configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_DEV_HUB);
  const defaultOrgProperty = configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG);

  return {
    defaultDevHubProperty,
    defaultOrgProperty,
    defaultDevHubUsername: defaultDevHubProperty ? await resolveUsernameFromAlias(defaultDevHubProperty) : undefined,
    defaultOrgUsername: defaultOrgProperty ? await resolveUsernameFromAlias(defaultOrgProperty) : undefined
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
export const determineOrgMarkers = (orgAuth: OrgAuthorization, defaultConfig: DefaultOrgConfig): string => {
  const possibleDefaults = new Set([...(orgAuth.aliases ?? []), orgAuth.username].filter(Boolean));

  // Check if this org is the default DevHub (by property value or resolved username)
  const matchesDevHubProperty =
    defaultConfig.defaultDevHubProperty != null && possibleDefaults.has(String(defaultConfig.defaultDevHubProperty));
  const matchesDevHubUsername =
    defaultConfig.defaultDevHubUsername != null && orgAuth.username === defaultConfig.defaultDevHubUsername;
  const isDefaultDevHub = orgAuth.isDevHub && (matchesDevHubProperty || matchesDevHubUsername);

  // Check if this org is the default org (by property value or resolved username).
  const matchesOrgProperty =
    defaultConfig.defaultOrgProperty != null && possibleDefaults.has(String(defaultConfig.defaultOrgProperty));
  const matchesOrgUsername =
    defaultConfig.defaultOrgUsername != null && orgAuth.username === defaultConfig.defaultOrgUsername;
  const isDefaultOrg = matchesOrgProperty || matchesOrgUsername;

  if (isDefaultDevHub && isDefaultOrg) {
    return `${ICONS.SF_DEFAULT_HUB} ${ICONS.SF_DEFAULT_ORG}`;
  } else if (isDefaultDevHub) {
    return ICONS.SF_DEFAULT_HUB;
  } else if (isDefaultOrg) {
    return ICONS.SF_DEFAULT_ORG;
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
