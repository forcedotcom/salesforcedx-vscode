/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  AuthFields,
  AuthInfo,
  AuthRemover,
  Config,
  Org,
  OrgAuthorization,
  OrgConfigProperties,
  StateAggregator
} from '@salesforce/core';
import { Column, createTable, Row, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { notificationService, workspaceUtils, ConfigAggregatorProvider } from '@salesforce/salesforcedx-utils-vscode';
import { ICONS } from '@salesforce/vscode-services';
import { Effect, Stream, SubscriptionRef } from 'effect';
import * as Chunk from 'effect/Chunk';
import * as Option from 'effect/Option';
import { isNotUndefined, isString } from 'effect/Predicate';
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
  const results = yield* Stream.fromIterableEffect(
    Effect.tryPromise({ try: () => AuthInfo.listAllAuthorizations(), catch: e => e }).pipe(
      Effect.tapError(e => Effect.logWarning('listAllAuthorizations failed', e)),
      Effect.orElseSucceed(() => [])
    )
  ).pipe(
    // only scratch org can expire
    Stream.filter(o => Boolean(o.isScratchOrg)),
    // Preserve alias from OrgAuthorization since AuthFields.alias may not be populated
    Stream.mapEffect(o =>
      Effect.tryPromise({ try: () => getAuthFieldsFor(o.username), catch: e => e }).pipe(
        Effect.tapError(e => Effect.logWarning(`skipping org ${o.username}: getAuthFieldsFor failed`, e)),
        Effect.map(fields => ({ ...fields, alias: fields.alias ?? o.aliases?.[0] })),
        Effect.option
      )
    ),
    Stream.filterMap(o => o),
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
    Stream.map(o => {
      const displayName = o.alias ? `${o.alias} - ${o.username!}` : o.username!;
      return nls.localize('pending_org_expiration_expires_on_message', displayName, o.expirationDate!);
    }),
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
const refreshConnection = Effect.fn('updateConfigAndStateAggregators', {
  root: true,
  attributes: { telemetryIgnore: true }
})(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ConfigService.invalidateConfigAggregator();
  yield* api.services.ConnectionService.invalidateCachedConnections();
  // tryPromise (not promise) routes a rejected connection refresh to the error channel so catchAll swallows it;
  // Effect.promise would surface the rejection as an uncatchable defect.
  yield* Effect.tryPromise(() => api.withDefaultOrg(() => undefined)).pipe(Effect.catchAll(() => Effect.void));
});

export const updateConfigAndStateAggregators = async (): Promise<void> => {
  // Force the ConfigAggregatorProvider to reload its stored
  // ConfigAggregators so that this config file change is accounted
  // for and the ConfigAggregators are updated with the latest info.
  const configAggregatorProvider = ConfigAggregatorProvider.getInstance();
  await configAggregatorProvider.reloadConfigAggregators();
  // Also force the StateAggregator to reload to have the latest
  // authorization info. Called without args to clear ALL cached instances,
  // including the default one used by AuthInfo.listAllAuthorizations().
  await StateAggregator.clearInstanceAsync();

  await getOrgRuntime().runPromise(refreshConnection());
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

/** A removable org plus the channel line describing why it's removable. */
type RemovableOrg = { username: string; logLine: string };

/** Classify a single org for removal WITHOUT mutating auth state, so the caller can confirm first. */
const classifyOrgForRemoval = async (orgAuth: OrgAuthorization): Promise<RemovableOrg | undefined> => {
  // Skip dev hubs
  if (orgAuth.isDevHub) {
    return undefined;
  }

  // Skip orgs with errors - they are likely already invalid
  if (orgAuth.error) {
    channelService.appendLine(nls.localize('org_list_clean_skipping_org_with_error', orgAuth.username, orgAuth.error));
    return undefined;
  }

  try {
    const authFields: AuthFields = await getAuthFieldsFor(orgAuth.username);

    // Scratch org whose expiration date has passed
    return authFields.expirationDate && new Date(authFields.expirationDate) < new Date()
      ? {
          username: orgAuth.username,
          logLine: nls.localize('org_list_clean_removing_expired_org', orgAuth.username, authFields.expirationDate)
        }
      : undefined;
  } catch (error) {
    // If we can't get auth fields, the org might be deleted/invalid - mark it for removal
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (shouldRemoveOrg(error)) {
      return {
        username: orgAuth.username,
        logLine: nls.localize('org_list_clean_removing_invalid_org', orgAuth.username, errorMessage)
      };
    }
    channelService.appendLine(nls.localize('org_list_clean_error_checking_org', orgAuth.username, errorMessage));
    return undefined;
  }
};

/** Lists all org authorizations via `ConnectionService.listAllAuthorizations` (wraps `AuthInfo.listAllAuthorizations`). */
const listAllAuthorizationsEffect = Effect.fn('OrgUtil.listAllAuthorizations')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConnectionService.listAllAuthorizations();
});

/**
 * Find expired/deleted orgs WITHOUT removing them, so the caller can show a confirm prompt
 * (or skip it entirely when there's nothing to remove).
 */
export const findRemovableOrgs = async (): Promise<RemovableOrg[]> => {
  const orgAuthorizations = await getOrgRuntime().runPromise(listAllAuthorizationsEffect());
  return (await Promise.all(orgAuthorizations.map(classifyOrgForRemoval))).filter(isNotUndefined);
};

/**
 * Remove the given orgs from local configuration.
 * Rejects on failure; the Effect caller (orgListCleanCommand) maps the rejection to OrgListCleanError.
 */
export const removeExpiredAndDeletedOrgs = async (removable: readonly RemovableOrg[]): Promise<string[]> => {
  const authRemover = await AuthRemover.create();

  // Remove sequentially (AuthRemover mutates shared auth state)
  const removed: string[] = [];
  for (const { username, logLine } of removable) {
    try {
      channelService.appendLine(logLine);
      await authRemover.removeAuth(username);
      removed.push(username);
    } catch (removeError) {
      channelService.appendLine(
        nls.localize(
          'org_list_clean_failed_to_remove_org',
          username,
          removeError instanceof Error ? removeError.message : String(removeError)
        )
      );
    }
  }
  return removed;
};

/** Default org configuration type */
type DefaultOrgConfig = {
  defaultDevHubProperty: string | undefined;
  defaultOrgProperty: string | undefined;
  defaultDevHubUsername: string | undefined;
  defaultOrgUsername: string | undefined;
};

/**
 * Returns the resolved username for a given alias, or the input if it is already a username.
 * Uses AliasService (reads alias.json via FsService, bypassing StateAggregator cache).
 */
export const resolveUsernameFromAliasEffect = Effect.fn('OrgUtil.resolveUsernameFromAlias')(function* (
  aliasOrUsername: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const aliasService = yield* api.services.AliasService;
  const opt = yield* aliasService.getUsernameFromAlias(aliasOrUsername);
  return Option.getOrElse(opt, () => aliasOrUsername);
});

/**
 * Returns a map of username → aliases[]. Used to supplement stale StateAggregator data in the org picker.
 * Uses AliasService (reads alias.json via FsService, bypassing StateAggregator cache).
 */
export const readAliasesByUsernameFromDiskEffect = Effect.fn('OrgUtil.readAliasesByUsernameFromDisk')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const aliasService = yield* api.services.AliasService;
  const orgs = yield* aliasService.getAllAliases();
  return Object.entries(orgs).reduce((result, [alias, username]) => {
    result.set(username, [...(result.get(username) ?? []), alias]);
    return result;
  }, new Map<string, string[]>());
});

/**
 * Loads default-org config + fresh org authorizations (alias-supplemented from disk) in one Effect.
 * Authorizations come from `ConnectionService.listAllAuthorizations` (wraps `AuthInfo.listAllAuthorizations`).
 * Consumed by the org pickers and `setDefaultOrg`.
 */
export const getFreshAuthorizations = Effect.fn('orgUtil.getFreshAuthorizations')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [defaultConfig, authorizations, aliasesByUsername] = yield* Effect.all([
    getDefaultOrgConfigurationEffect(),
    api.services.ConnectionService.listAllAuthorizations(),
    readAliasesByUsernameFromDiskEffect()
  ]);

  // Supplement stale StateAggregator alias data with fresh disk data
  const freshAuthorizations = authorizations.map(org =>
    org.aliases?.length ? org : { ...org, aliases: aliasesByUsername.get(org.username) ?? [] }
  );

  return { defaultConfig, freshAuthorizations };
});

/** Get default org and devhub configuration */
const getDefaultOrgConfigurationEffect = Effect.fn('OrgUtil.getDefaultOrgConfiguration')(function* () {
  const configAggregator = yield* getConfigAggregatorEffect;
  const defaultDevHubProperty = configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_DEV_HUB);
  const defaultOrgProperty = configAggregator.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG);

  return {
    defaultDevHubProperty,
    defaultOrgProperty,
    defaultDevHubUsername: defaultDevHubProperty
      ? yield* resolveUsernameFromAliasEffect(defaultDevHubProperty)
      : undefined,
    defaultOrgUsername: defaultOrgProperty ? yield* resolveUsernameFromAliasEffect(defaultOrgProperty) : undefined
  } satisfies DefaultOrgConfig;
});

/** Promise wrapper for {@link getDefaultOrgConfigurationEffect}. */
export const getDefaultOrgConfiguration = async (): Promise<DefaultOrgConfig> =>
  getOrgRuntime().runPromise(getDefaultOrgConfigurationEffect());

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
    const orgAuthorizations = await getOrgRuntime().runPromise(listAllAuthorizationsEffect());
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
