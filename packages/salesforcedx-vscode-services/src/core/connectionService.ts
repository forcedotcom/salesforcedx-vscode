/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, StateAggregator, OrgConfigProperties } from '@salesforce/core';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { getCliId } from '../observability/cliTelemetry';
import { setWebUserId, UNAUTHENTICATED_USER } from '../observability/webUserId';
import { SettingsService } from '../vscode/settingsService';
import { ConfigService } from './configService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { DefaultOrgInfoSchema } from './schemas/defaultOrgInfo';
import { getOrgFromConnection, unknownToErrorCause } from './shared';

type WebConnectionKey = {
  instanceUrl: string;
  accessToken: string;
};

type WebConnectionKeyAndApiVersion = WebConnectionKey & { apiVersion: string };

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

class FailedToGetTracksSourceError extends Schema.TaggedError<FailedToGetTracksSourceError>()(
  'FailedToGetTracksSourceError',
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

const createDesktopConnection = (username: string) =>
  Effect.gen(function* () {
    const authInfo = yield* createAuthInfoFromUsername(username);
    return yield* createConnection(authInfo);
  }).pipe(Effect.withSpan('createDesktopConnection (cache miss)', { attributes: { username } }));

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

export class ConnectionService extends Effect.Service<ConnectionService>()('ConnectionService', {
  accessors: true,
  dependencies: [ConfigService.Default, SettingsService.Default],
  effect: Effect.gen(function* () {
    const configService = yield* ConfigService;
    const settingsService = yield* SettingsService;

    /** Get a Connection to the target org */
    const getConnection = Effect.fn('ConnectionService.getConnection')(function* () {
      const conn = yield* process.env.ESBUILD_PLATFORM === 'web'
        ? Effect.gen(function* () {
            // Web environment - get connection from settings
            const instanceUrl = yield* settingsService.getInstanceUrl;
            const accessToken = yield* settingsService.getAccessToken;
            const apiVersion = yield* settingsService.getApiVersion;
            return yield* connectionCache.get(toKey(instanceUrl, accessToken, apiVersion));
          })
        : Effect.gen(function* () {
            const usernameOrAlias = yield* configService.getConfigAggregator().pipe(
              Effect.map(agg => agg.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG)),
              Effect.filterOrFail(
                targetOrg => targetOrg != null,
                () => new NoTargetOrgConfiguredError({ message: 'No target org configured' })
              )
            );
            const username = yield* Effect.tryPromise({
              try: async () => (await StateAggregator.getInstance()).aliases.resolveUsername(usernameOrAlias),
              catch: error => {
                const { cause } = unknownToErrorCause(error);
                return new FailedToResolveUsernameError({
                  message: `Failed to resolve username "${usernameOrAlias}": ${cause.message}`,
                  cause
                });
              }
            });
            return yield* connectionCache.get(username);
          });

      // update the org ref in the background
      yield* maybeUpdateDefaultOrgRef(conn).pipe(Effect.forkDaemon);
      return conn;
    });

    return { getConnection } as const;
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
const maybeUpdateDefaultOrgRef = (conn: Connection) =>
  Effect.gen(function* () {
    const { orgId, devHubUsername, isScratch, isSandbox, tracksSource } = conn.getAuthInfoFields();
    const defaultOrgRef = yield* getDefaultOrgRef();
    const [{ username, user_id: userId }, devHubOrgId, existingOrgInfo, cliId] = yield* Effect.all(
      [
        Effect.tryPromise(() => conn.identity()).pipe(
          // best efforts, its just telemetry
          Effect.catchAll(() => Effect.succeed({ username: undefined, user_id: undefined }))
        ),
        Effect.flatten(getDevHubId(devHubUsername)),
        SubscriptionRef.get(defaultOrgRef),
        Effect.flatten(getCliId())
      ],
      { concurrency: 'unbounded' }
    );

    yield* Effect.annotateCurrentSpan({
      orgId,
      devHubUsername,
      isScratch,
      isSandbox,
      tracksSource,
      username,
      userId,
      devHubOrgId
    });

    const webUserId =
      existingOrgInfo.webUserId === UNAUTHENTICATED_USER && orgId && userId
        ? // ooh, now we know who they are, so we set that
          yield* setWebUserId(orgId, userId)
        : (existingOrgInfo.webUserId ?? UNAUTHENTICATED_USER);

    const updates = Object.fromEntries(
      Object.entries({
        orgId,
        devHubUsername,
        tracksSource: tracksSource ?? (yield* getTracksSourceFromOrg(conn)),
        isScratch,
        isSandbox,
        devHubOrgId,
        userId,
        webUserId,
        ...(typeof cliId === 'string' ? { cliId } : {})
      } satisfies typeof DefaultOrgInfoSchema.Type).filter(([, v]) => v !== undefined)
    );

    const updated = Object.fromEntries(
      Object.entries({
        ...existingOrgInfo,
        ...updates
      })
    );

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
  }).pipe(Effect.withSpan('maybeUpdateDefaultOrgRef'));

/** for a given scratch org username, get the orgId of its devhub.  Requires the scratch org AND devhub to be authenticated locally */
const getDevHubId = (scratchOrgUsername?: string) =>
  (scratchOrgUsername
    ? createAuthInfoFromUsername(scratchOrgUsername).pipe(Effect.map(authInfo => authInfo.getFields().orgId))
    : Effect.succeed(undefined)
  ).pipe(Effect.cached);

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
