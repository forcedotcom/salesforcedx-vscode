/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, OrgConfigProperties, StateAggregator } from '@salesforce/core';

import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getCliId } from '../observability/cliTelemetry';
import { setWebUserId, UNAUTHENTICATED_USER } from '../observability/webUserId';
import { ExtensionContextService } from '../vscode/extensionContextService';
import { SettingsService } from '../vscode/settingsService';
import { NoWorkspaceOpenError } from '../vscode/workspaceService';
import { AliasService } from './alias';
import { ConfigService, FailedToCreateConfigAggregatorError } from './configService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { DefaultOrgInfoSchema } from './schemas/defaultOrgInfo';
import { getOrgFromConnection, unknownToErrorCause } from './shared';

type WebConnectionKey = {
  instanceUrl: string;
  accessToken: string;
};

type WebConnectionKeyAndApiVersion = WebConnectionKey & { apiVersion: string };

export const updateDefaultOrgIdentity = Effect.fn('updateDefaultOrgIdentity')(function* (
  defaultOrgRef: SubscriptionRef.SubscriptionRef<typeof DefaultOrgInfoSchema.Type>,
  orgId: string | undefined,
  instanceName: string | undefined
) {
  const current = yield* SubscriptionRef.get(defaultOrgRef);
  if (current.orgId === orgId && current.instanceName === instanceName) return current.orgId;

  yield* SubscriptionRef.set(defaultOrgRef, { ...current, orgId, instanceName });
  return current.orgId;
});

export class FailedToCreateAuthInfoError extends Schema.TaggedError<FailedToCreateAuthInfoError>()(
  'FailedToCreateAuthInfoError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

export class FailedToSaveAuthInfoError extends Schema.TaggedError<FailedToSaveAuthInfoError>()(
  'FailedToSaveAuthInfoError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

export class FailedToCreateConnectionError extends Schema.TaggedError<FailedToCreateConnectionError>()(
  'FailedToCreateConnectionError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

export class FailedToResolveUsernameError extends Schema.TaggedError<FailedToResolveUsernameError>()(
  'FailedToResolveUsernameError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

export class NoTargetOrgConfiguredError extends Schema.TaggedError<NoTargetOrgConfiguredError>()(
  'NoTargetOrgConfiguredError',
  {
    message: Schema.String
  }
) {}

export class AccessTokenExpiredError extends Schema.TaggedError<AccessTokenExpiredError>()('AccessTokenExpiredError', {
  message: Schema.String,
  username: Schema.optional(Schema.String)
}) {}

export class InactiveOrgOperationError extends Schema.TaggedError<InactiveOrgOperationError>()(
  'InactiveOrgOperationError',
  {
    message: Schema.String,
    expectedOrgId: Schema.String,
    observedOrgId: Schema.optional(Schema.String)
  }
) {}

class FailedToGetTracksSourceError extends Schema.TaggedError<FailedToGetTracksSourceError>()(
  'FailedToGetTracksSourceError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

export class FailedToListAuthorizationsError extends Schema.TaggedError<FailedToListAuthorizationsError>()(
  'FailedToListAuthorizationsError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.instanceOf(Error))
  }
) {}

/** side effect: save the auth info in the background */
const createWebAuthInfo = (instanceUrl: string, accessToken: string) =>
  Effect.tryPromise({
    try: () =>
      AuthInfo.create({
        accessTokenOptions: { accessToken, loginUrl: instanceUrl, instanceUrl }
      }),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToCreateAuthInfoError({
        message: `Failed to create auth info: ${cause.message}`,
        cause
      });
    }
  }).pipe(
    Effect.tap(authInfo => Effect.annotateCurrentSpan(authInfo.getFields())),
    Effect.tap(authInfo =>
      // to keep things snappy, save happens in the background
      Effect.fork(
        Effect.tryPromise({
          try: () => authInfo.save(),
          catch: error => {
            const { cause } = unknownToErrorCause(error);
            return new FailedToSaveAuthInfoError({
              message: `Failed to save auth info: ${cause.message}`,
              cause
            });
          }
        }).pipe(
          Effect.tap(savedAuthInfo => Effect.annotateCurrentSpan({ authFields: savedAuthInfo.getFields() })),
          Effect.withSpan('saveAuthInfo')
        )
      )
    ),

    Effect.withSpan('createWebAuthInfo')
  );

const createConnection = (authInfo: AuthInfo, apiVersion?: string) =>
  Effect.tryPromise({
    // calling the org to get the API version really slows things down, so we want it in config
    try: () => Connection.create({ authInfo, ...(apiVersion ? { connectionOptions: { version: apiVersion } } : {}) }),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToCreateConnectionError({
        message: `Failed to create connection: ${cause.message}`,
        cause
      });
    }
  }).pipe(Effect.withSpan('createConnection', { attributes: { apiVersion: apiVersion ?? 'default' } }));

const createWebConnection = (key: string) => {
  const { instanceUrl, accessToken, apiVersion } = fromKey(key);
  return createWebAuthInfo(instanceUrl, accessToken).pipe(
    Effect.flatMap(authInfo => createConnection(authInfo, apiVersion)),
    Effect.withSpan('createWebConnection (cache miss)', {
      attributes: { apiVersion, instanceUrl }
    })
  );
};

// use string cache keys, objects don't seem to work
const toKey = (instanceUrl: string, accessToken: string, apiVersion: string): string =>
  `${instanceUrl}###${accessToken}###${apiVersion}`;

const fromKey = (key: string): WebConnectionKeyAndApiVersion => {
  const [instanceUrl, accessToken, apiVersion] = key.split('###');
  return { instanceUrl, accessToken, apiVersion };
};

const createDesktopConnection = Effect.fn('createDesktopConnection (cache miss)')(function* (username: string) {
  yield* Effect.annotateCurrentSpan({ username });
  const authInfo = yield* createAuthInfoFromUsername(username);
  return yield* createConnection(authInfo);
});

const connectionCache = Effect.runSync(
  Cache.makeWith({
    capacity: process.env.ESBUILD_PLATFORM === 'web' ? 1 : 100,
    timeToLive: Exit.match({
      onSuccess: () => (process.env.ESBUILD_PLATFORM === 'web' ? Duration.infinity : Duration.minutes(30)),
      onFailure: () => Duration.zero
    }),
    lookup: process.env.ESBUILD_PLATFORM === 'web' ? createWebConnection : createDesktopConnection
  })
);

const resolveUsername = (conn: Connection): string | undefined =>
  conn.getUsername() ?? conn.getAuthInfoFields().username;

type IdentityResult = { username: string; userId: string };

const identityCache = new Map<string, IdentityResult>();

const getUserFromUserSobject = (orgId: string, conn: Connection) => {
  const cached = identityCache.get(orgId);
  if (cached) return Effect.succeed(cached);

  const username = resolveUsername(conn);
  if (!username) return Effect.void;

  return Effect.tryPromise(() =>
    conn.query<{ Id: string; Username: string }>(`SELECT Id, Username FROM User WHERE Username = '${username}'`)
  ).pipe(
    Effect.map(r => {
      const record = r.records[0];
      if (!record) return undefined;
      const result = { username: record.Username, userId: record.Id };
      identityCache.set(orgId, result);
      return result;
    }),
    Effect.tapError(e => Effect.logWarning('User query failed', { orgId, cause: String(e) })),
    Effect.catchAll(() => Effect.void),
    Effect.withSpan('getUserFromUserSobject', { attributes: { orgId } })
  );
};

export class ConnectionService extends Effect.Service<ConnectionService>()('ConnectionService', {
  accessors: true,
  dependencies: [ConfigService.Default, SettingsService.Default, AliasService.Default],
  effect: Effect.gen(function* () {
    const configService = yield* ConfigService;
    const settingsService = yield* SettingsService;
    const aliasService = yield* AliasService;

    // explicit type breaks the promptReauth → reauthCache → runReauthLookup → promptReauth inference cycle
    const promptReauth: (
      conn: Connection,
      username: string
    ) => Effect.Effect<never, NoWorkspaceOpenError | FailedToCreateConfigAggregatorError | AccessTokenExpiredError> =
      Effect.fn('ConnectionService.promptReauth')(function* (conn: Connection, username: string) {
        // Preserve existing alias on reauth (not arbitrary first-registered alias).
        const targetOrgOrAlias = yield* configService.getTargetOrg();
        const alias = targetOrgOrAlias && targetOrgOrAlias !== username ? targetOrgOrAlias : undefined;
        const loginButton = nls.localize('error_access_token_expired_login_button');
        const selection = yield* Effect.promise(() =>
          vscode.window.showErrorMessage(
            nls.localize('error_access_token_expired'),
            { modal: true, detail: nls.localize('error_access_token_expired_detail') },
            loginButton
          )
        );
        if (selection === loginButton) {
          yield* Effect.promise(() =>
            vscode.commands.executeCommand('sf.org.login.web', conn.instanceUrl, alias ?? username)
          );
          // executeCommand blocks until login finishes; fresh auth file on disk. Invalidate both caches so the
          // next getConnection rebuilds AuthInfo AND re-runs the reauth probe against the new token (the failed
          // reauth entry is keyed by username, so it must be dropped explicitly or it would stay cached 30min).
          yield* invalidateCachedConnections();
          yield* reauthCache.invalidate(username);
        }
        return yield* new AccessTokenExpiredError({
          message: nls.localize('error_access_token_refresh_failed'),
          username
        });
      });

    // Keyed by RESOLVED USERNAME (matching connectionCache), NOT the Connection object: connectionCache is
    // invalidated on every config-file change (configFileWatcher) + on org switch, so a Connection-keyed reauth
    // cache would treat each rebuilt Connection for the SAME org as new and re-prompt — stacking a modal per
    // invalidation. Re-fetch the Connection here (cache hit in the common path; a fresh valid one if it was
    // invalidated) so identity() always probes the current auth.
    const runReauthLookup = Effect.fn('ConnectionService.runReauthLookup')(function* (username: string) {
      const conn = yield* connectionCache.get(username);
      yield* Effect.tryPromise(() => conn.identity()).pipe(Effect.catchAll(() => promptReauth(conn, username)));
    });

    // Dedup concurrent identity() calls per username. Success TTL 1min (re-probe mid-session tokens).
    // Failure TTL 30min: one modal per username per session; reauth's invalidate drops it so a fresh login re-probes.
    const reauthCache = yield* Cache.makeWith({
      capacity: 100,
      timeToLive: Exit.match({
        onSuccess: () => Duration.minutes(1),
        onFailure: () => Duration.minutes(30)
      }),
      lookup: runReauthLookup
    });

    /**
     * If the connection uses the access-token (session-ID) flow — which cannot silently refresh — validate
     * that the token still works via `identity()`. On failure, show a modal and (if accepted) dispatch
     * `sf.org.login.web`. No-op for refreshable (web/JWT) flows.
     */
    const validateAccessTokenOrPromptReauth = Effect.fn('ConnectionService.validateAccessTokenOrPromptReauth')(
      function* (conn: Connection) {
        if (!conn.getAuthInfo().isAccessTokenFlow()) return;
        const username = resolveUsername(conn);
        if (!username) return;
        yield* reauthCache.get(username);
      }
    );

    /**
     * Get a Connection to an org. Desktop: `username` given → alias-resolve it and skip the config
     * `target-org` lookup; omitted → resolve the configured default org (unchanged). Web ignores the param.
     * When `username` is given, the default-org ref is NOT mutated (an arbitrary org must not overwrite it).
     */
    const getConnection = Effect.fn('ConnectionService.getConnection')(function* (username?: string) {
      const conn = yield* process.env.ESBUILD_PLATFORM === 'web'
        ? Effect.gen(function* () {
            // Web environment - get connection from settings
            const instanceUrl = yield* settingsService.getInstanceUrl();
            const accessToken = yield* settingsService.getAccessToken();
            const apiVersion = yield* settingsService.getApiVersion();

            return yield* connectionCache.get(toKey(instanceUrl, accessToken, apiVersion));
          })
        : Effect.gen(function* () {
            const usernameOrAlias =
              username ??
              (yield* configService.getConfigAggregator().pipe(
                Effect.map(agg => agg.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG)),
                Effect.filterOrFail(
                  isNotUndefined,
                  () => new NoTargetOrgConfiguredError({ message: 'No target org configured' })
                )
              ));
            // Session-ID orgs can't silently refresh; validate before returning so ALL consumers
            // see reauth modal on expired token. No-op for refreshable flows.
            return yield* aliasService.getUsernameFromAlias(usernameOrAlias).pipe(
              Effect.map(Option.getOrElse(() => usernameOrAlias)),
              Effect.flatMap(resolved => connectionCache.get(resolved)),
              Effect.tap(validateAccessTokenOrPromptReauth)
            );
          });

      // Update the org ref in the background only for the default org (no explicit username).
      if (isUndefined(username)) {
        const { orgId, instanceName: rawInstanceName } = conn.getAuthInfoFields();
        const instanceName = rawInstanceName?.trim();
        const defaultOrgRef = yield* getDefaultOrgRef();
        const previousOrgId = yield* updateDefaultOrgIdentity(defaultOrgRef, orgId, instanceName);
        yield* maybeUpdateDefaultOrgRef(conn, previousOrgId).pipe(
          Effect.provideService(AliasService, aliasService),
          Effect.provideService(ConfigService, configService),
          Effect.tapError(e => Effect.logWarning(String(e))),
          Effect.catchAll(() => Effect.void),
          Effect.forkDaemon
        );
      }
      return conn;
    });

    const getConnectionForOrg = Effect.fn('ConnectionService.getConnectionForOrg')(function* (expectedOrgId: string) {
      const connection = yield* getConnection();
      const observedOrgId = connection.getAuthInfoFields().orgId;
      if (observedOrgId === expectedOrgId) return connection;
      return yield* new InactiveOrgOperationError({
        message: nls.localize('org_operation_target_changed', expectedOrgId),
        expectedOrgId,
        ...(observedOrgId ? { observedOrgId } : {})
      });
    });

    /** Drops cached JSForce `Connection` instances so the next `getConnection()` reloads `AuthInfo` from disk. */
    const invalidateCachedConnections = Effect.fn('ConnectionService.invalidateCachedConnections')(function* () {
      yield* connectionCache.invalidateAll;
    });

    /**
     * List all org authorizations known to the CLI (wraps `AuthInfo.listAllAuthorizations`).
     * Clears the StateAggregator first: `AuthInfo.listAllAuthorizations` reads via a cached
     * StateAggregator whose `orgs.readAll` only *adds* to its `configs` map and never evicts
     * entries for files deleted out of process (orgAccessor.js `readAll` L81-103). A logged-out
     * org (its auth file removed by `AuthRemover.removeAuth`) therefore lingers in the cache, so
     * the org pickers keep listing it. Resetting the instance forces a fresh disk read.
     */
    const listAllAuthorizations = Effect.fn('ConnectionService.listAllAuthorizations')(function* () {
      yield* Effect.promise(() => StateAggregator.clearInstanceAsync());
      return yield* Effect.tryPromise({
        try: () => AuthInfo.listAllAuthorizations(),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new FailedToListAuthorizationsError({
            message: `Failed to list authorizations: ${cause.message}`,
            cause
          });
        }
      });
    });

    return {
      getConnection,
      getConnectionForOrg,
      validateAccessTokenOrPromptReauth,
      invalidateCachedConnections,
      listAllAuthorizations
    };
  })
}) {}

const getTracksSourceFromOrg = (conn: Connection) =>
  getOrgFromConnection(conn).pipe(
    Effect.andThen(org =>
      Effect.tryPromise({
        try: () => org.tracksSource(),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new FailedToGetTracksSourceError({
            message: `Failed to get tracks source from org: ${cause.message}`,
            cause
          });
        }
      })
    ),
    Effect.withSpan('getTracksSourceFromOrg')
  );

//** this info is used for quite a bit (ex: telemetry) so one we make the connection, we capture the info and store it in a ref */
const maybeUpdateDefaultOrgRef = Effect.fn('maybeUpdateDefaultOrgRef')(function* (
  conn: Connection,
  previousOrgId?: string
) {
  const aliasService = yield* AliasService;
  const configService = yield* ConfigService;
  const {
    orgId,
    instanceName: rawInstanceName,
    devHubUsername,
    isScratch,
    isSandbox,
    tracksSource,
    orgEdition
  } = conn.getAuthInfoFields();
  const instanceName = rawInstanceName?.trim();
  const defaultOrgRef = yield* getDefaultOrgRef();
  const existingOrgInfo = yield* SubscriptionRef.get(defaultOrgRef);
  const orgIdChanged = previousOrgId !== orgId;
  const [{ username: queriedUsername, userId: queriedUserId }, devHubOrgId, cliId] = yield* Effect.all(
    [
      orgIdChanged || isUndefined(existingOrgInfo.username) || isUndefined(existingOrgInfo.userId)
        ? orgId
          ? getUserFromUserSobject(orgId, conn).pipe(
              Effect.map(identity => identity ?? { username: undefined, userId: undefined })
            )
          : Effect.succeed({ username: undefined, userId: undefined })
        : Effect.succeed({ username: existingOrgInfo.username, userId: existingOrgInfo.userId }),
      existingOrgInfo.devHubOrgId ? Effect.succeed(existingOrgInfo.devHubOrgId) : getDevHubId(devHubUsername),
      existingOrgInfo.cliId
        ? Effect.succeed(existingOrgInfo.cliId)
        : getCliId().pipe(Effect.map(Option.getOrElse(() => undefined)))
    ],
    { concurrency: 'unbounded' }
  );

  // User SOQL can fail or return nothing (query/API edge cases) while AuthInfo still has the login username.
  // Without this fallback, TargetOrgRef stays username-less and the org picker / display-org commands misreport "no default org".
  const authUsername = resolveUsername(conn);
  const username = queriedUsername ?? authUsername ?? undefined;
  const userId = queriedUserId;
  const targetOrg = yield* configService.getTargetOrg();
  const alias = targetOrg && targetOrg !== username ? targetOrg : undefined;

  const aliases =
    username && (orgIdChanged || existingOrgInfo.username !== username)
      ? yield* aliasService.getAliasesFromUsername(username)
      : existingOrgInfo.aliases;

  yield* Effect.annotateCurrentSpan({
    orgId,
    devHubUsername,
    isScratch,
    isSandbox,
    tracksSource,
    username,
    alias,
    userId,
    devHubOrgId,
    aliases
  });

  const webUserId =
    existingOrgInfo.webUserId === UNAUTHENTICATED_USER && orgId && userId
      ? // ooh, now we know who they are, so we set that.

        // Pipe the extension context in for ServicesExtension so we don't get context from another ext
        yield* setWebUserId(orgId, userId).pipe(Effect.provide(ExtensionContextService.Default))
      : (existingOrgInfo.webUserId ?? UNAUTHENTICATED_USER);

  const updates = Object.fromEntries(
    Object.entries({
      orgId,
      instanceName,
      devHubUsername,
      tracksSource: tracksSource ?? (yield* getTracksSourceFromOrg(conn)),
      isScratch,
      isSandbox,
      devHubOrgId,
      userId,
      webUserId,
      aliases,
      username,
      alias,
      ...(isString(cliId) ? { cliId } : {}),
      ...(isString(orgEdition) ? { orgEdition } : {})
    } satisfies typeof DefaultOrgInfoSchema.Type).filter(([, v]) => isNotUndefined(v))
  );

  const updated = { ...existingOrgInfo, ...updates, alias };

  // Check if objects have the same content (deep equality using schema)
  // otherwise, calling set on the ref counts as a change but it's really not one.
  if (Schema.equivalence(DefaultOrgInfoSchema)(updated, existingOrgInfo)) {
    yield* Effect.annotateCurrentSpan({ changed: false });
    return updated;
  }
  yield* Effect.all(
    [Effect.annotateCurrentSpan({ updated, changed: true }), SubscriptionRef.set(defaultOrgRef, updated)],
    {
      concurrency: 'unbounded'
    }
  );
  return updated;
});

/** for a given scratch org username, get the orgId of its devhub.  Requires the scratch org AND devhub to be authenticated locally */
const buildDevHubId = Effect.fn('getDevHubId')(function* (devHubUsername?: string) {
  yield* Effect.annotateCurrentSpan({ devHubUsername });
  if (!devHubUsername) {
    return undefined;
  }
  // a failed lookup (e.g. devhub not yet authenticated) is swallowed to undefined and memoized like any success — not retried this session
  const authInfo = yield* createAuthInfoFromUsername(devHubUsername).pipe(Effect.orElseSucceed(() => undefined));
  return authInfo?.getFields().orgId;
});

// memoized per distinct devHubUsername at module scope so AuthInfo.create (and the getDevHubId span) runs once per devhub per session
const getDevHubId = Effect.runSync(Effect.cachedFunction(buildDevHubId));

const createAuthInfoFromUsername = (username: string) =>
  Effect.tryPromise({
    try: () => AuthInfo.create({ username }),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToCreateAuthInfoError({
        message: `Failed to create auth info for username "${username}": ${cause.message}`,
        cause
      });
    }
  }).pipe(Effect.withSpan('createAuthInfoFromUsername', { attributes: { username } }));
