/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, AuthRemover, OrgAuthorization, StateAggregator } from '@salesforce/core';
import { Column, createTable, Row, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { ICONS } from '@salesforce/vscode-services';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isError, isNotNullable, isNotUndefined, isString, not } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { getOrgRuntime } from '../extensionProvider';
import { nls } from '../messages';

const DAYS_BEFORE_EXPIRE = 5;

/**
 * Raised when reloading the on-disk StateAggregator cache rejects.
 * Surfaces a real message to ErrorHandlerService instead of escaping as a defect.
 * @ExportTaggedError
 */
export class AggregatorReloadError extends Schema.TaggedError<AggregatorReloadError>()('AggregatorReloadError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

/**
 * Raised when `AuthInfo.create`/`getFields` rejects for a username (leaf Promise, no runtime re-entry).
 */
export class GetAuthFieldsError extends Schema.TaggedError<GetAuthFieldsError>()('GetAuthFieldsError', {
  message: Schema.String,
  username: Schema.String
}) {}

/** Raised when `conn.refreshAuth()` live-probe rejects while checking a non-scratch org's connection (caught in-fn). */
class OrgConnectionCheckError extends Schema.TaggedError<OrgConnectionCheckError>()('OrgConnectionCheckError', {
  cause: Schema.Unknown,
  username: Schema.String
}) {}

/** Raised when `AuthRemover.removeAuth` rejects for a single username (caught in-fn, tracked as a partition failure). */
class RemoveAuthError extends Schema.TaggedError<RemoveAuthError>()('RemoveAuthError', {
  message: Schema.String,
  username: Schema.String
}) {}

/**
 * Raised when `AuthRemover.create()` rejects while removing expired/deleted orgs.
 * @ExportTaggedError
 */
export class AuthRemoverCreateError extends Schema.TaggedError<AuthRemoverCreateError>()('AuthRemoverCreateError', {
  message: Schema.String
}) {}

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
  const channel = yield* api.services.ChannelService;

  const defaultOrgRef = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  const results = yield* Stream.fromIterableEffect(
    listAllAuthorizationsEffect().pipe(
      Effect.tapError(e => Effect.logWarning('listAllAuthorizations failed', e)),
      Effect.orElseSucceed(() => [])
    )
  ).pipe(
    // only scratch org can expire
    Stream.filter(o => Boolean(o.isScratchOrg)),
    // Preserve alias from OrgAuthorization since AuthFields.alias may not be populated
    Stream.mapEffect(o =>
      getAuthFieldsFor(o.username).pipe(
        Effect.tapError(e => Effect.logWarning(`skipping org ${o.username}: getAuthFieldsFor failed`, e)),
        Effect.map(fields => ({ ...fields, alias: fields.alias ?? o.aliases?.[0] })),
        Effect.option
      )
    ),
    Stream.filterMap(o => o),
    Stream.tap(o =>
      // special warning about when default orgs expire
      defaultOrgRef.username && o.username === defaultOrgRef.username && orgIsExpired(o)
        ? Effect.sync(() => void vscode.window.showWarningMessage(nls.localize('default_org_expired')))
        : Effect.void
    ),
    // Filter out the expired orgs.
    Stream.filter(not(orgIsExpired)),
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

  yield* channel.appendToChannel(
    nls.localize(
      'pending_org_expiration_output_channel_message',
      DAYS_BEFORE_EXPIRE,
      Chunk.toArray(results).join('\n\n')
    )
  );

  // Runs unbidden (forkDaemon), so must not reveal the channel: focus-out cancels an open picker.
  // Offer Show Output; reveal only on click.
  const showOutputText = nls.localize('org_login_web_show_output_button_text');
  const selection = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('pending_org_expiration_notification_message', DAYS_BEFORE_EXPIRE),
      showOutputText
    )
  );
  if (selection === showOutputText) {
    yield* channel.showChannel;
  }
});

/** Fetch AuthFields for a username. Leaf Promise (`AuthInfo.create`/`getFields`); no runtime re-entry. */
export const getAuthFieldsFor = Effect.fn('OrgUtil.getAuthFieldsFor')(function* (username: string) {
  return yield* Effect.tryPromise({
    try: async () => {
      const authInfo: AuthInfo = await AuthInfo.create({ username });
      return authInfo.getFields();
    },
    catch: cause => new GetAuthFieldsError({ message: String(cause), username })
  });
});
/**
 * Effect form of {@link updateConfigAndStateAggregators}. Reloads the on-disk
 * StateAggregator cache, then invalidates the services-api config/connection
 * caches and re-fetches the connection. Exported so Effect commands can `yield*` it directly
 * instead of bouncing through the async wrapper (which re-enters the runtime via runPromise).
 */
export const updateConfigAndStateAggregatorsEffect = Effect.fn('updateConfigAndStateAggregators', {
  root: true,
  attributes: { telemetryIgnore: true }
})(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  // Force the StateAggregator to drop ALL cached instances (incl. the default used by
  // AuthInfo.listAllAuthorizations) so this config file change is accounted for.
  yield* Effect.tryPromise({
    try: () => StateAggregator.clearInstanceAsync(),
    catch: cause => new AggregatorReloadError({ message: 'Failed to reload state aggregator', cause: String(cause) })
  });
  yield* api.services.ConfigService.invalidateConfigAggregator();
  yield* api.services.ConnectionService.invalidateCachedConnections();
  yield* api.services.ConnectionService.getConnection().pipe(Effect.catchAll(() => Effect.void));
});

export class ConfigRefreshError extends Schema.TaggedError<ConfigRefreshError>()('ConfigRefreshError', {
  message: Schema.String
}) {}

export const updateConfigAndStateAggregators = async (): Promise<void> => {
  await getOrgRuntime().runPromise(updateConfigAndStateAggregatorsEffect());
};

/** Get connection status from error */
export const getConnectionStatusFromError = (err: any, username?: string): string => {
  const message = isError(err) ? err.message : String(err);
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
  const lowerMsg = (isError(err) ? err.message : String(err)).toLowerCase();
  return ['invalid_login', 'no such org', 'namedorgnotfound', 'noauthinfofound'].some(msg => lowerMsg.includes(msg));
};

/** Check actual connection status by testing the connection */
export const determineConnectedStatusForNonScratchOrg = Effect.fn('OrgUtil.determineConnectedStatusForNonScratchOrg')(
  function* (username: string) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const conn = yield* api.services.ConnectionService.getConnection(username);

    // Skip connection testing for scratch orgs (they have a devHubUsername)
    return conn.getAuthInfoFields().devHubUsername
      ? undefined
      : yield* Effect.tryPromise({
          try: () => conn.refreshAuth(),
          catch: cause => new OrgConnectionCheckError({ cause, username: conn.getUsername() ?? username })
        }).pipe(Effect.as('Connected'));
  },
  // Every connection-status error (the refreshAuth live-probe failure + the getConnection tags) maps to
  // a status string via getConnectionStatusFromError, which reads .message so a bad auth still classifies
  // (e.g. NamedOrgNotFound → "Invalid org: <username>"). Enumerating the tags gives compile-time
  // exhaustiveness over the error channel. OrgConnectionCheckError uses its own .cause/.username fields.
  (self, username: string) =>
    self.pipe(
      Effect.catchTags({
        OrgConnectionCheckError: err => Effect.succeed(getConnectionStatusFromError(err.cause, err.username)),
        NoTargetOrgConfiguredError: err => Effect.succeed(getConnectionStatusFromError(err, username)),
        FailedToCreateConfigAggregatorError: err => Effect.succeed(getConnectionStatusFromError(err, username)),
        FailedToCreateAuthInfoError: err => Effect.succeed(getConnectionStatusFromError(err, username)),
        FailedToCreateConnectionError: err => Effect.succeed(getConnectionStatusFromError(err, username)),
        MissingSettingsError: err => Effect.succeed(getConnectionStatusFromError(err, username)),
        NoWorkspaceOpenError: err => Effect.succeed(getConnectionStatusFromError(err, username))
      })
    )
);

/** A removable org plus the channel line describing why it's removable. */
type RemovableOrg = { username: string; logLine: string };

/** Classify a single org for removal WITHOUT mutating auth state, so the caller can confirm first. */
const classifyOrgForRemoval = Effect.fn('OrgUtil.classifyOrgForRemoval')(function* (orgAuth: OrgAuthorization) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  // Skip dev hubs
  if (orgAuth.isDevHub) {
    return undefined;
  }

  // Skip orgs with errors - they are likely already invalid
  if (orgAuth.error) {
    yield* channel.appendToChannel(
      nls.localize('org_list_clean_skipping_org_with_error', orgAuth.username, orgAuth.error)
    );
    return undefined;
  }

  return yield* getAuthFieldsFor(orgAuth.username).pipe(
    Effect.map((authFields): RemovableOrg | undefined =>
      // Scratch org whose expiration date has passed
      authFields.expirationDate && new Date(authFields.expirationDate) < new Date()
        ? {
            username: orgAuth.username,
            logLine: nls.localize('org_list_clean_removing_expired_org', orgAuth.username, authFields.expirationDate)
          }
        : undefined
    ),
    // If we can't get auth fields, the org might be deleted/invalid - mark it for removal
    Effect.catchTag('GetAuthFieldsError', error =>
      shouldRemoveOrg(error)
        ? Effect.succeed<RemovableOrg | undefined>({
            username: orgAuth.username,
            logLine: nls.localize('org_list_clean_removing_invalid_org', orgAuth.username, error.message)
          })
        : channel
            .appendToChannel(nls.localize('org_list_clean_error_checking_org', orgAuth.username, error.message))
            .pipe(Effect.as(undefined))
    )
  );
});

/** Lists all org authorizations via `ConnectionService.listAllAuthorizations` (wraps `AuthInfo.listAllAuthorizations`). */
const listAllAuthorizationsEffect = Effect.fn('OrgUtil.listAllAuthorizations')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConnectionService.listAllAuthorizations();
});

/**
 * Find expired/deleted orgs WITHOUT removing them, so the caller can show a confirm prompt
 * (or skip it entirely when there's nothing to remove).
 */
export const findRemovableOrgs = Effect.fn('OrgUtil.findRemovableOrgs')(function* () {
  const orgAuthorizations = yield* listAllAuthorizationsEffect();
  const classified = yield* Effect.forEach(orgAuthorizations, classifyOrgForRemoval, { concurrency: 'unbounded' });
  return classified.filter(isNotUndefined);
});

/**
 * Remove the given orgs from local configuration.
 * Fails on `AuthRemover.create` rejection; the command maps that to OrgListCleanError.
 * Per-org removal failures are logged and skipped (keep-going).
 */
export const removeExpiredAndDeletedOrgs = Effect.fn('OrgUtil.removeExpiredAndDeletedOrgs')(function* (
  removable: readonly RemovableOrg[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;
  const authRemover = yield* Effect.tryPromise({
    try: () => AuthRemover.create(),
    catch: cause => new AuthRemoverCreateError({ message: String(cause) })
  });

  // Remove sequentially (AuthRemover mutates shared auth state); keep going on per-org failure.
  const [failures, removed] = yield* Effect.partition(
    removable,
    ({ username, logLine }) =>
      channel.appendToChannel(logLine).pipe(
        Effect.andThen(
          Effect.tryPromise({
            try: () => authRemover.removeAuth(username),
            catch: removeError =>
              new RemoveAuthError({
                message: isError(removeError) ? removeError.message : String(removeError),
                username
              })
          })
        ),
        Effect.as(username)
      ),
    { concurrency: 1 }
  );
  yield* Effect.forEach(
    failures,
    ({ username, message }) =>
      channel.appendToChannel(nls.localize('org_list_clean_failed_to_remove_org', username, message)),
    { discard: true }
  );
  return removed;
});

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
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [defaultDevHubProperty, defaultOrgProperty] = yield* Effect.all([
    api.services.ConfigService.getTargetDevHub(),
    api.services.ConfigService.getTargetOrg()
  ]);

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
    isNotNullable(defaultConfig.defaultDevHubProperty) &&
    possibleDefaults.has(String(defaultConfig.defaultDevHubProperty));
  const matchesDevHubUsername =
    isNotNullable(defaultConfig.defaultDevHubUsername) && orgAuth.username === defaultConfig.defaultDevHubUsername;
  const isDefaultDevHub = orgAuth.isDevHub && (matchesDevHubProperty || matchesDevHubUsername);

  // Check if this org is the default org (by property value or resolved username).
  const matchesOrgProperty =
    isNotNullable(defaultConfig.defaultOrgProperty) && possibleDefaults.has(String(defaultConfig.defaultOrgProperty));
  const matchesOrgUsername =
    isNotNullable(defaultConfig.defaultOrgUsername) && orgAuth.username === defaultConfig.defaultOrgUsername;
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
const processOrgForDisplay = Effect.fn('OrgUtil.processOrgForDisplay')(
  function* (orgAuth: OrgAuthorization, defaultConfig: DefaultOrgConfig) {
    // isExpired is `boolean | 'unknown'`: non-scratch orgs (e.g. the dev hub) have no expirationDate
    // so @salesforce/core reports 'unknown' (authInfo.js). A loose truthy check drops them (and thus
    // never runs determineConnectedStatusForNonScratchOrg) — only skip orgs that are DEFINITELY expired.
    if (orgAuth.isExpired === true) {
      return undefined;
    }
    const authFields = yield* getAuthFieldsFor(orgAuth.username);

    // Determine status by actually testing the connection
    const status = authFields.expirationDate
      ? 'Active' // For scratch orgs, we assume they're active if not expired
      : // For non-scratch orgs, test the actual connection
        ((yield* determineConnectedStatusForNonScratchOrg(orgAuth.username)) ?? 'Connected');
    // Determine expiration date display
    return {
      '': determineOrgMarkers(orgAuth, defaultConfig),
      Type: determineOrgType(orgAuth, authFields),
      Alias: orgAuth.aliases?.[0] ?? '',
      Username: orgAuth.username,
      'Org Id': authFields.orgId ?? '',
      Status: status,
      Expires: authFields.expirationDate ? new Date(authFields.expirationDate).toISOString().split('T')[0] : ''
    } satisfies Row;
  },
  // Skip orgs that we can't process; log for debugging but continue processing other orgs
  Effect.catchTag('GetAuthFieldsError', error =>
    Effect.logWarning(`Failed to process org ${error.username}: ${error.message}`).pipe(Effect.as(undefined))
  )
);

const ORG_TABLE_COLUMNS: Column[] = [
  { key: '', label: '' },
  { key: 'Type', label: 'Type' },
  { key: 'Alias', label: 'Alias' },
  { key: 'Username', label: 'Username' },
  { key: 'Org Id', label: 'Org Id' },
  { key: 'Status', label: 'Status' },
  { key: 'Expires', label: 'Expires' }
];

/** Create and display the org table via the Effect ChannelService (same channel as the command). */
const createAndDisplayOrgTable = Effect.fn('OrgUtil.createAndDisplayOrgTable')(function* (orgData: Row[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  if (orgData.length === 0) {
    yield* channel.appendToChannel(`\n${nls.localize('org_list_no_orgs_found')}`);
    return;
  }

  const tableOutput = createTable(orgData, ORG_TABLE_COLUMNS, '');
  yield* channel.appendToChannel(`\n${tableOutput}`);

  // Add legend
  yield* channel.appendToChannel('\nLegend:  🌳=Default DevHub, 🍁=Default Org');
});

/** Display remaining orgs in a table format */
export const displayRemainingOrgs = Effect.fn('OrgUtil.displayRemainingOrgs')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  // Log-and-swallow ALL display failures (list auths, config aggregator, per-org processing) so a
  // display error after a successful clean never surfaces as an unrelated command error to the user.
  yield* Effect.gen(function* () {
    const orgAuthorizations = yield* listAllAuthorizationsEffect();
    if (orgAuthorizations.length === 0) {
      yield* channel.appendToChannel(`\n${nls.localize('org_list_no_orgs_found')}`);
      return;
    }

    // Get default org configuration
    const defaultConfig = yield* getDefaultOrgConfigurationEffect();

    // Process each org authorization into display data
    const orgData = (yield* Effect.forEach(orgAuthorizations, orgAuth => processOrgForDisplay(orgAuth, defaultConfig), {
      concurrency: 'unbounded'
    })).filter(isNotUndefined);

    // Create and display the table
    yield* createAndDisplayOrgTable(orgData);
  }).pipe(
    Effect.catchAll(error =>
      channel.appendToChannel(
        `\n${nls.localize('org_list_display_error', 'message' in error ? error.message : String(error))}`
      )
    )
  );
});
