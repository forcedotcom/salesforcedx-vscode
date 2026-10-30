/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Org, StateAggregator } from '@salesforce/core';
import {
  AccessTokenExpiredError,
  AliasService,
  AuthFields,
  ConfigService,
  ConnectionService,
  FailedToCreateAuthInfoError,
  FailedToCreateConnectionError,
  FailedToListAuthorizationsError,
  FailedToSaveAuthInfoError,
  GetAuthFieldsError,
  InactiveOrgOperationError,
  NoTargetOrgConfiguredError,
  SettingsService,
  authFieldsFromConnection,
  orgIdFrom,
  orgIdFromConnection,
  type ConnectionError,
  type DefaultOrgInfo,
  type OrgId
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Cache from 'effect/Cache';
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as Exit from 'effect/Exit';
import * as Hash from 'effect/Hash';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isObject, isUndefined } from 'effect/Predicate';
import * as Rec from 'effect/Record';
import * as Redacted from 'effect/Redacted';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { ConnectionHost } from './connectionHost.js';
import { fetchCliId, setWebUserId, UNAUTHENTICATED_USER } from './connectionTelemetry.js';
import { unknownToErrorCause } from './errorCause.js';
import { executeQuery } from './queryExecute.js';
import { makeScopedFibers } from './scopedFiber.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';

const connectionErrorTags = [
  'MissingSettingsError',
  'NoWorkspaceOpenError',
  'FailedToCreateConfigAggregatorError',
  'FailedToCreateAuthInfoError',
  'FailedToCreateConnectionError',
  'NoTargetOrgConfiguredError',
  'AccessTokenExpiredError'
] as const;

const lookupStarted = Context.Reference<Option.Option<Ref.Ref<boolean>>>(
  '@salesforce/vscode-services-v4-implementation/ConnectionLookupStarted',
  { defaultValue: Option.none }
);
// Cache.makeWith merges the lookup caller's context; only the actual lookup marks its caller.
const markLookup = lookupStarted.pipe(
  Effect.flatMap(Option.match({ onNone: () => Effect.void, onSome: ref => Ref.set(ref, true) }))
);
const cached = Effect.fnUntraced(function* <K, A, E, R>(
  cache: Cache.Cache<K, A, E, R>,
  key: K,
  attribute: 'connectionCache' | 'identityCache'
) {
  const started = yield* Ref.make(false);
  const value = yield* Cache.get(cache, key).pipe(Effect.provideService(lookupStarted, Option.some(started)));
  const miss = yield* Ref.get(started);
  yield* Effect.annotateCurrentSpan({
    [attribute]: miss ? 'miss' : 'hit',
    ...(attribute === 'connectionCache' && !miss ? { telemetryIgnore: true } : {})
  });
  return value;
});
const createAuthInfo = Effect.fn('createAuthInfoFromUsername')(function* (username: string) {
  yield* Effect.annotateCurrentSpan({ username });
  return yield* Effect.tryPromise({
    try: () => AuthInfo.create({ username }),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToCreateAuthInfoError({
        message: `Failed to create auth info for username "${username}": ${cause.message}`,
        cause
      });
    }
  });
});
const createConnection = Effect.fn('createConnection')(function* (authInfo: AuthInfo, apiVersion?: string) {
  yield* Effect.annotateCurrentSpan({ apiVersion: apiVersion ?? 'default' });
  return yield* Effect.tryPromise({
    try: () => Connection.create({ authInfo, ...(apiVersion ? { connectionOptions: { version: apiVersion } } : {}) }),
    catch: error => {
      const { cause } = unknownToErrorCause(error);
      return new FailedToCreateConnectionError({ message: `Failed to create connection: ${cause.message}`, cause });
    }
  });
});
const resolveUsername = (connection: Connection) =>
  connection.getUsername() ??
  Option.getOrUndefined(Option.flatMap(authFieldsFromConnection(connection), fields => fields.username));
type IdentityKey = Equal.Equal & { readonly orgId: OrgId; readonly username: string; readonly connection: Connection };
const identityKey = (orgId: OrgId, username: string, connection: Connection): IdentityKey => ({
  orgId,
  username,
  connection,
  [Hash.symbol]: () => Hash.combine(Hash.string(username))(Hash.string(orgId)),
  [Equal.symbol]: (that: unknown) =>
    isObject(that) && 'orgId' in that && that.orgId === orgId && 'username' in that && that.username === username
});
class WebConnectionKey extends Data.Class<{
  readonly instanceUrl: string;
  readonly accessToken: Redacted.Redacted<string>;
  readonly apiVersion: string;
}> {}
class ConnectionEnrichmentError extends Schema.TaggedError<ConnectionEnrichmentError>()('ConnectionEnrichmentError', {
  message: Schema.String,
  cause: Schema.Unknown
}) {}
const enrichmentError = (cause: unknown) =>
  new ConnectionEnrichmentError({ message: 'Failed to enrich default org', cause });
const queryIdentity = Effect.fnUntraced(function* (key: IdentityKey) {
  return yield* executeQuery(
    key.connection,
    { soql: `SELECT Id, Username FROM User WHERE Username = '${key.username}'` },
    Schema.Struct({ Id: Schema.String, Username: Schema.String })
  ).pipe(
    Effect.flatMap(result => Stream.runCollect(result.records)),
    Effect.map(records =>
      Arr.head(records).pipe(Option.map(record => ({ username: record.Username, userId: record.Id })))
    ),
    Effect.catchTag(['UnknownError', 'SoqlError', 'FieldError', 'SchemaError'], error =>
      Effect.logWarning('User query failed', { orgId: key.orgId, cause: String(error) }).pipe(
        Effect.as(Option.none<{ username: string; userId: string }>())
      )
    )
  );
});

/** Internal watcher operation reserves a generation before invalidating or resolving configuration. */
export class DefaultOrgConnection extends Context.Service<
  DefaultOrgConnection,
  {
    readonly refresh: Effect.Effect<void>;
    readonly authSettingsChanged: Effect.Effect<void>;
  }
>()('@salesforce/vscode-services-v4-implementation/DefaultOrgConnection') {}

export const ConnectionServiceLayer = Layer.effectContext(
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const settings = yield* SettingsService;
    const alias = yield* AliasService;
    const orgChanges = yield* OrgChanges;
    const host = yield* ConnectionHost;
    const operations = yield* ServiceOperations;
    const scopedFibers = yield* makeScopedFibers;
    const cliId = yield* Effect.cached(fetchCliId());
    const desktopCache = yield* Cache.makeWith(
      (username: string) =>
        markLookup.pipe(
          Effect.andThen(createAuthInfo(username)),
          Effect.flatMap(auth => createConnection(auth)),
          Effect.withSpan('createDesktopConnection (cache miss)', { attributes: { username } })
        ),
      { capacity: 100, timeToLive: exit => (Exit.isSuccess(exit) ? Duration.minutes(30) : Duration.zero) }
    );
    const webCache = yield* Cache.makeWith(
      (key: WebConnectionKey) =>
        markLookup.pipe(
          Effect.andThen(
            Effect.gen(function* () {
              const sessionContext = yield* settings.getSessionContext();
              const auth = yield* Effect.tryPromise({
                try: () =>
                  AuthInfo.create({
                    accessTokenOptions: {
                      accessToken: Redacted.value(key.accessToken),
                      loginUrl: key.instanceUrl,
                      instanceUrl: key.instanceUrl,
                      ...sessionContext
                    }
                  }),
                catch: error => {
                  const { cause } = unknownToErrorCause(error);
                  return new FailedToCreateAuthInfoError({
                    message: `Failed to create auth info: ${cause.message}`,
                    cause
                  });
                }
              }).pipe(Effect.withSpan('createWebAuthInfo'));
              // The SDK cannot abort save(); its bounded persistent write must finish before shutdown returns.
              yield* Effect.tryPromise({
                try: () => auth.save(),
                catch: error => {
                  const { cause } = unknownToErrorCause(error);
                  return new FailedToSaveAuthInfoError({
                    message: `Failed to save auth info: ${cause.message}`,
                    cause
                  });
                }
              }).pipe(
                Effect.withSpan('saveAuthInfo'),
                Effect.tapError(Effect.logWarning),
                Effect.orDie,
                Effect.uninterruptible,
                scopedFibers.fork
              );
              return yield* createConnection(auth, key.apiVersion);
            })
          ),
          Effect.withSpan('createWebConnection (cache miss)', {
            attributes: { instanceUrl: key.instanceUrl, apiVersion: key.apiVersion }
          })
        ),
      { capacity: 1, timeToLive: exit => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero) }
    );
    const identityCache = yield* Cache.makeWith(
      (key: IdentityKey) => markLookup.pipe(Effect.andThen(queryIdentity(key))),
      {
        capacity: 8,
        timeToLive: exit => (Exit.isSuccess(exit) && Option.isSome(exit.value) ? Duration.infinity : Duration.zero)
      }
    );
    const devHubCache = yield* Cache.make({
      capacity: Number.POSITIVE_INFINITY,
      lookup: Effect.fn('getDevHubId')((username: string | undefined) =>
        username
          ? createAuthInfo(username).pipe(
              Effect.map(auth => Option.getOrUndefined(orgIdFrom(auth.getFields()))),
              Effect.catchTag('FailedToCreateAuthInfoError', () => Effect.void)
            )
          : Effect.void
      )
    });
    const invalidateCachedConnections = Effect.fn('ConnectionService.invalidateCachedConnections')(() =>
      Effect.all([Cache.invalidateAll(desktopCache), Cache.invalidateAll(webCache)], { discard: true })
    );
    const promptReauth = Effect.fn('ConnectionService.promptReauth')(function* (
      connection: Connection,
      username: string
    ): Effect.fn.Return<never, ConnectionError> {
      const target = yield* config.getTargetOrg();
      const selection = yield* Effect.promise(() =>
        vscode.window.showErrorMessage(
          host.messages.expired,
          { modal: true, detail: host.messages.expiredDetail },
          host.messages.login
        )
      );
      if (selection === host.messages.login) {
        yield* Effect.promise(() =>
          vscode.commands.executeCommand(
            'sf.org.login.web',
            connection.instanceUrl,
            target && target !== username ? target : username
          )
        );
        yield* invalidateCachedConnections();
        yield* Cache.invalidate(reauthCache, username);
      }
      return yield* new AccessTokenExpiredError({ message: host.messages.refreshFailed, username });
    }, operations.run);
    // Key by resolved username, not Connection identity: invalidation must not stack reauth modals.
    // Accepted login drops this entry; otherwise retain success 1 minute / failure 30 minutes.
    const reauthCache = yield* Cache.makeWith(
      Effect.fn('ConnectionService.runReauthLookup')((username: string) =>
        Cache.get(desktopCache, username).pipe(
          Effect.flatMap(connection =>
            Effect.tryPromise(() => connection.identity()).pipe(
              Effect.catchTag('UnknownError', () => promptReauth(connection, username))
            )
          ),
          Effect.asVoid
        )
      ),
      { capacity: 100, timeToLive: exit => (Exit.isSuccess(exit) ? Duration.minutes(1) : Duration.minutes(30)) }
    );
    const validateAccessTokenOrPromptReauth = Effect.fn('ConnectionService.validateAccessTokenOrPromptReauth')(
      function* (connection: Connection) {
        if (!connection.getAuthInfo().isAccessTokenFlow()) return;
        const username = resolveUsername(connection);
        if (username) yield* Cache.get(reauthCache, username);
      },
      operations.run
    );
    yield* Effect.addFinalizer(() =>
      Effect.all(
        [
          invalidateCachedConnections(),
          Cache.invalidateAll(identityCache),
          Cache.invalidateAll(reauthCache),
          Cache.invalidateAll(devHubCache)
        ],
        { discard: true }
      )
    );

    const enrich = Effect.fn('maybeUpdateDefaultOrgRef')(function* (connection: Connection, generation: number) {
      const before = yield* orgChanges.snapshot;
      if (before.generation !== generation) return;
      const fields = Option.getOrUndefined(authFieldsFromConnection(connection));
      const orgId = Option.getOrUndefined(fields?.orgId ?? Option.none());
      const username = resolveUsername(connection);
      const devHubUsername = Option.getOrUndefined(fields?.devHubUsername ?? Option.none());
      const [identity, devHubOrgId, installId] = yield* Effect.all(
        [
          orgId && username
            ? cached(identityCache, identityKey(orgId, username, connection), 'identityCache').pipe(
                Effect.withSpan('getUserFromUserSobject')
              )
            : Effect.succeed(Option.none()),
          before.org.devHubOrgId ? Effect.succeed(before.org.devHubOrgId) : Cache.get(devHubCache, devHubUsername),
          before.org.cliId ? Effect.succeed(Option.some(before.org.cliId)) : cliId
        ],
        { concurrency: 'unbounded' }
      );
      const resolvedUsername = Option.isSome(identity) ? identity.value.username : username;
      const userId = Option.isSome(identity) ? identity.value.userId : undefined;
      const target = yield* config.getTargetOrg();
      const aliases = resolvedUsername ? yield* alias.getAliasesFromUsername(resolvedUsername) : undefined;
      const tracksSource =
        Option.getOrUndefined(fields?.tracksSource ?? Option.none()) ??
        (yield* Effect.tryPromise({
          try: () => Org.create({ connection }),
          catch: enrichmentError
        }).pipe(
          Effect.withSpan('Org.create'),
          Effect.flatMap(org =>
            Effect.tryPromise({
              try: () => org.tracksSource(),
              catch: enrichmentError
            })
          ),
          Effect.withSpan('getTracksSourceFromOrg')
        ));
      const updates: DefaultOrgInfo = Rec.filter(
        {
          orgId,
          username: resolvedUsername,
          userId,
          devHubUsername,
          devHubOrgId,
          tracksSource,
          isScratch: Option.getOrUndefined(fields?.isScratch ?? Option.none()),
          isSandbox: Option.getOrUndefined(fields?.isSandbox ?? Option.none()),
          orgEdition: Option.getOrUndefined(fields?.orgEdition ?? Option.none()),
          cliId: Option.getOrUndefined(installId)
        },
        value => value !== undefined
      );
      yield* orgChanges.update(generation, latest =>
        Effect.gen(function* () {
          // The bounded global-state write shares the selection validation/commit mask.
          const webUserId =
            latest.org.webUserId === UNAUTHENTICATED_USER && orgId && userId
              ? yield* setWebUserId(orgId, userId).pipe(Effect.provideService(ConnectionHost, host))
              : (latest.org.webUserId ?? UNAUTHENTICATED_USER);
          return {
            ...latest.org,
            ...updates,
            webUserId,
            ...(latest.aliasesRevision === before.aliasesRevision
              ? { aliases, alias: target && target !== resolvedUsername ? target : undefined }
              : {})
          };
        })
      );
    });
    const resolveConnection = Effect.fn('ConnectionService.resolveConnection')(function* (username?: string) {
      if (process.env.ESBUILD_PLATFORM === 'web') {
        const instanceUrl = yield* settings.getInstanceUrl();
        const accessToken = yield* settings.getAccessToken();
        const apiVersion = yield* settings.getApiVersion();
        return yield* cached(
          webCache,
          new WebConnectionKey({ instanceUrl, accessToken, apiVersion }),
          'connectionCache'
        ).pipe(Effect.withSpan('ConnectionService.connectionCache.get'));
      }
      const target = username ?? (yield* config.getTargetOrg());
      if (isUndefined(target)) return yield* new NoTargetOrgConfiguredError({ message: 'No target org configured' });
      return yield* alias.getUsernameFromAlias(target).pipe(
        Effect.map(Option.getOrElse(() => target)),
        Effect.flatMap(resolved =>
          cached(desktopCache, resolved, 'connectionCache').pipe(
            Effect.withSpan('ConnectionService.connectionCache.get')
          )
        ),
        Effect.tap(validateAccessTokenOrPromptReauth)
      );
    });
    const selectDefault = Effect.fn('ConnectionService.selectDefault')(function* (reload: boolean) {
      // Reserve before config/auth awaits, not after a slower earlier request has completed.
      const generation = yield* orgChanges.begin;
      if (reload) {
        yield* config.invalidateConfigAggregator();
        yield* invalidateCachedConnections();
      }
      const connection = yield* resolveConnection().pipe(
        Effect.tapError(() => (reload ? orgChanges.clearIfCurrent(generation) : Effect.void))
      );
      const orgId = Option.getOrUndefined(orgIdFromConnection(connection));
      const username = resolveUsername(connection);
      const instanceName = Option.getOrUndefined(
        Option.flatMap(authFieldsFromConnection(connection), fields => fields.instanceName)
      );
      const selected = yield* orgChanges.update(generation, ({ org: current }) =>
        Effect.succeed({
          ...(current.orgId === orgId && current.username === username
            ? current
            : {
                ...(current.cliId ? { cliId: current.cliId } : {}),
                ...(current.webUserId ? { webUserId: current.webUserId } : {})
              }),
          orgId,
          instanceName,
          username
        })
      );
      if (selected)
        yield* enrich(connection, generation).pipe(
          Effect.catchTag(
            ['ConnectionEnrichmentError', 'NoWorkspaceOpenError', 'FailedToCreateConfigAggregatorError'],
            Effect.logWarning
          ),
          scopedFibers.fork
        );
      return connection;
    });
    const getConnection = Effect.fn('ConnectionService.getConnection')(function* (username?: string) {
      return yield* isUndefined(username) ? selectDefault(false) : resolveConnection(username);
    }, operations.run);
    const service = ConnectionService.of({
      getConnection,
      validateAccessTokenOrPromptReauth,
      invalidateCachedConnections: Effect.fn('ConnectionService.invalidateCachedConnections.public')(
        invalidateCachedConnections,
        operations.run
      ),
      getConnectionForOrg: Effect.fn('ConnectionService.getConnectionForOrg')(function* (expectedOrgId: OrgId) {
        const connection = yield* getConnection();
        const observedOrgId = Option.getOrUndefined(orgIdFromConnection(connection));
        if (observedOrgId !== expectedOrgId)
          return yield* new InactiveOrgOperationError({
            message: host.messages.orgChanged(expectedOrgId),
            expectedOrgId,
            ...(observedOrgId ? { observedOrgId } : {})
          });
        return connection;
      }, operations.run),
      getAuthInfoFields: Effect.fn('ConnectionService.getAuthInfoFields')(function* (username?: string) {
        const connection = yield* getConnection(username).pipe(
          Effect.catchTag(connectionErrorTags, error =>
            Effect.fail(new GetAuthFieldsError({ message: error.message, ...(username ? { username } : {}) }))
          )
        );
        const fields = authFieldsFromConnection(connection);
        if (Option.isNone(fields))
          return yield* new GetAuthFieldsError({
            message: 'Unable to decode auth fields',
            ...((username ?? connection.getUsername()) ? { username: username ?? connection.getUsername() } : {})
          });
        return Schema.encodeSync(AuthFields)(fields.value);
      }, operations.run),
      listAllAuthorizations: Effect.fn('ConnectionService.listAllAuthorizations')(function* () {
        // StateAggregator's orgs.readAll only adds to its cached map: auth files removed by another
        // process remain listed. Reset before reading so logged-out orgs disappear from pickers.
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
      }, operations.run)
    });
    yield* Effect.addFinalizer(() => operations.close);
    return Context.make(ConnectionService, service).pipe(
      Context.add(DefaultOrgConnection, {
        refresh: selectDefault(true).pipe(
          Effect.asVoid,
          Effect.catchTag(connectionErrorTags, Effect.logWarning),
          operations.run
        ),
        // Auth settings can be temporarily incomplete; retain the previous identity on failure.
        authSettingsChanged: selectDefault(false).pipe(
          Effect.asVoid,
          Effect.catchTag(connectionErrorTags, () => Effect.void),
          operations.run
        )
      })
    );
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
