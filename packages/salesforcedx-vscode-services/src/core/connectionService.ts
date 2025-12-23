/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, StateAggregator, OrgConfigProperties } from '@salesforce/core';
import * as Cache from 'effect/Cache';
import Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SettingsService } from '../vscode/settingsService';
import { ConfigService } from './configService';
import { DefaultOrgInfoSchema, defaultOrgRef } from './defaultOrgService';
import { getOrgFromConnection, unknownToErrorCause } from './shared';

type WebConnectionKey = {
  instanceUrl: string;
  accessToken: string;
};

type WebConnectionKeyAndApiVersion = WebConnectionKey & { apiVersion: string };

export class FailedToCreateAuthInfoError extends Data.TaggedError('FailedToCreateAuthInfoError')<{
  readonly cause: unknown;
}> {}

export class FailedToSaveAuthInfoError extends Data.TaggedError('FailedToSaveAuthInfoError')<{
  readonly cause: unknown;
}> {}

export class FailedToCreateConnectionError extends Data.TaggedError('FailedToCreateConnectionError')<{
  readonly cause: unknown;
}> {}

export class FailedToResolveUsernameError extends Data.TaggedError('FailedToResolveUsernameError')<{
  readonly cause: unknown;
}> {}

export class NoTargetOrgConfiguredError extends Data.TaggedError('NoTargetOrgConfiguredError')<{}> {}

export class FailedToGetTracksSourceError extends Data.TaggedError('FailedToGetTracksSourceError')<{
  readonly cause: unknown;
}> {}

/** side effect: save the auth info in the background */
const createWebAuthInfo = (instanceUrl: string, accessToken: string) =>
  Effect.tryPromise({
    try: () =>
      AuthInfo.create({
        accessTokenOptions: { accessToken, loginUrl: instanceUrl, instanceUrl }
      }),
    catch: error => new FailedToCreateAuthInfoError(unknownToErrorCause(error))
  }).pipe(
    Effect.tap(authInfo => Effect.annotateCurrentSpan(authInfo.getFields())),
    Effect.tap(authInfo =>
      // to keep things snappy, save happens in the background
      Effect.fork(
        Effect.tryPromise({
          try: () => authInfo.save(),
          catch: error => new FailedToSaveAuthInfoError(unknownToErrorCause(error))
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
    catch: error => new FailedToCreateConnectionError(unknownToErrorCause(error))
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

const cache = Effect.runSync(
  Cache.make({
    capacity: 100,
    timeToLive: Duration.infinity,
    lookup: process.env.ESBUILD_PLATFORM === 'web' ? createWebConnection : createDesktopConnection
  })
);

// when the org changes, invalidate the cache
Effect.runSync(Effect.forkDaemon(defaultOrgRef.changes.pipe(Stream.runForEach(() => cache.invalidateAll))));

export class ConnectionService extends Effect.Service<ConnectionService>()('ConnectionService', {
  effect: Effect.gen(function* () {
    return {
      /** Get a Connection to the target org */
      getConnection: Effect.gen(function* () {
        if (process.env.ESBUILD_PLATFORM === 'web') {
          // Web environment - get connection from settings
          const settingsService = yield* SettingsService;
          const instanceUrl = yield* settingsService.getInstanceUrl;
          const accessToken = yield* settingsService.getAccessToken;
          const apiVersion = yield* settingsService.getApiVersion;

          return yield* cache.get(toKey(instanceUrl, accessToken, apiVersion));
        } else {
          const usernameOrAlias = yield* ConfigService.pipe(
            Effect.flatMap(cfgSvc => cfgSvc.getConfigAggregator),
            Effect.map(agg => agg.getPropertyValue<string>(OrgConfigProperties.TARGET_ORG)),
            Effect.filterOrFail(
              targetOrg => targetOrg != null,
              () => new NoTargetOrgConfiguredError()
            )
          );
          const username = yield* Effect.tryPromise({
            try: async () => (await StateAggregator.getInstance()).aliases.resolveUsername(usernameOrAlias),
            catch: error => new FailedToResolveUsernameError(unknownToErrorCause(error))
          });
          return yield* cache.get(username);
        }
      }).pipe(
        // update the org ref in the background
        Effect.tap(conn => maybeUpdateDefaultOrgRef(conn).pipe(Effect.forkDaemon)),
        Effect.withSpan('getConnection')
      )
    } as const;
  }),
  dependencies: [ConfigService.Default]
}) {}

const getTracksSourceFromOrg = (conn: Connection) =>
  getOrgFromConnection(conn).pipe(
    Effect.andThen(org =>
      Effect.tryPromise({
        try: () => org.tracksSource(),
        catch: error => new FailedToGetTracksSourceError(unknownToErrorCause(error))
      })
    ),
    Effect.withSpan('getTracksSourceFromOrg')
  );

//** this info is used for quite a bit (ex: telemetry) so one we make the connection, we capture the info and store it in a ref */
const maybeUpdateDefaultOrgRef = (conn: Connection) =>
  Effect.gen(function* () {
    const { orgId, devHubUsername, isScratch, isSandbox, tracksSource } = conn.getAuthInfoFields();

    yield* Effect.annotateCurrentSpan({ orgId, devHubUsername, isScratch, isSandbox, tracksSource });
    const devHubOrgId = yield* yield* Effect.cached(getDevHubId(devHubUsername));
    const existingOrgInfo = yield* SubscriptionRef.get(defaultOrgRef);

    const updates = Object.fromEntries(
      Object.entries({
        orgId,
        devHubUsername,
        tracksSource: tracksSource ?? (yield* getTracksSourceFromOrg(conn)),
        isScratch,
        isSandbox,
        devHubOrgId
      }).filter(([, v]) => v !== undefined)
    );

    const updated = Object.fromEntries(
      Object.entries({
        ...existingOrgInfo,
        ...updates
      })
    );
    // Check if objects have the same content (deep equality using schema)
    // otherwise, calling set on the ref counts as a change bu it's really not one.
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
  scratchOrgUsername
    ? createAuthInfoFromUsername(scratchOrgUsername).pipe(Effect.map(authInfo => authInfo.getFields().orgId))
    : Effect.succeed(undefined);

const createAuthInfoFromUsername = (username: string) =>
  Effect.tryPromise({
    try: () => AuthInfo.create({ username }),
    catch: error => new FailedToCreateAuthInfoError(unknownToErrorCause(error))
  }).pipe(Effect.withSpan('createAuthInfoFromUsername', { attributes: { username } }));
