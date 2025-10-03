/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Global } from '@salesforce/core';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SdkLayer } from '../observability/spans';
import { SettingsService } from '../vscode/settingsService';
import { ConfigService } from './configService';
import { DefaultOrgInfoSchema, defaultOrgRef } from './defaultOrgService';

type WebConnectionKey = {
  instanceUrl: string;
  accessToken: string;
};

type WebConnectionKeyAndApiVersion = WebConnectionKey & { apiVersion: string };

const createAuthInfo = (instanceUrl: string, accessToken: string): Effect.Effect<AuthInfo, Error> =>
  Effect.tryPromise({
    try: () =>
      AuthInfo.create({
        accessTokenOptions: { accessToken, loginUrl: instanceUrl, instanceUrl }
      }),
    catch: error => new Error('Failed to create AuthInfo', { cause: error })
  }).pipe(
    Effect.tap(authInfo => Effect.annotateCurrentSpan(authInfo.getFields())),
    Effect.withSpan('createAuthInfo')
  );

const createConnection = (authInfo: AuthInfo, apiVersion: string): Effect.Effect<Connection, Error> =>
  Effect.tryPromise({
    // calling the org to get the API version really slows things down, so we want it in config
    try: () => Connection.create({ authInfo, connectionOptions: { version: apiVersion } }),
    catch: error => new Error('Failed to create Connection', { cause: error })
  }).pipe(Effect.withSpan('createConnection', { attributes: { apiVersion } }));

const createWebConnection = (key: string): Effect.Effect<Connection, Error> => {
  const { instanceUrl, accessToken, apiVersion } = fromKey(key);
  return createAuthInfo(instanceUrl, accessToken).pipe(
    Effect.flatMap(authInfo => createConnection(authInfo, apiVersion)),
    Effect.withSpan('createWebConnection (cache miss)', {
      attributes: { apiVersion }
    }),
    Effect.provide(SdkLayer)
  );
};

// use string cache keys, objects don't seem to work
const toKey = (instanceUrl: string, accessToken: string, apiVersion: string): string =>
  `${instanceUrl}###${accessToken}###${apiVersion}`;

const fromKey = (key: string): WebConnectionKeyAndApiVersion => {
  const [instanceUrl, accessToken, apiVersion] = key.split('###');
  return { instanceUrl, accessToken, apiVersion };
};

const cache = Effect.runSync(
  Cache.make({
    capacity: 100,
    timeToLive: Duration.infinity,
    lookup: createWebConnection
  })
);

// when the org changes, invalidate the cache
Effect.runSync(Effect.forkDaemon(defaultOrgRef.changes.pipe(Stream.runForEach(() => cache.invalidateAll))));

export class ConnectionService extends Effect.Service<ConnectionService>()('ConnectionService', {
  effect: Effect.gen(function* () {
    return {
      /** Get a Connection to the target org */
      getConnection: Effect.gen(function* () {
        if (Global.isWeb) {
          // Web environment - get connection from settings
          const settingsService = yield* SettingsService;
          const instanceUrl = yield* settingsService.getInstanceUrl;
          const accessToken = yield* settingsService.getAccessToken;
          const apiVersion = yield* settingsService.getApiVersion;

          return yield* cache.get(toKey(instanceUrl, accessToken, apiVersion));
        } else {
          return yield* ConfigService.pipe(
            Effect.flatMap(cfgSvc => cfgSvc.getConfigAggregator),
            Effect.map(agg => agg.getPropertyValue<string>('target-org')),
            Effect.flatMap(username =>
              Effect.tryPromise({
                try: () => AuthInfo.create({ username }),
                catch: error => new Error('Failed to create AuthInfo', { cause: error })
              })
            ),
            Effect.flatMap(authInfo =>
              Effect.tryPromise({
                try: () => Connection.create({ authInfo }),
                catch: error => new Error('Failed to create Connection', { cause: error })
              })
            )
          );
        }
      }).pipe(
        Effect.tap(conn => maybeUpdateDefaultOrgRef(conn)),
        Effect.provide(SdkLayer),
        Effect.withSpan('getConnection')
      )
    } as const;
  }),
  dependencies: [SettingsService.Default, ConfigService.Default]
}) {}

//** this info is used for quite a bit (ex: telemetry) so one we make the connection, we capture the info and store it in a ref */
const maybeUpdateDefaultOrgRef = (conn: Connection): Effect.Effect<typeof DefaultOrgInfoSchema.Type, Error> =>
  Effect.gen(function* () {
    const { orgId, devHubUsername, isScratch, isSandbox, tracksSource } = conn.getAuthInfoFields();

    const devHubOrgId = yield* yield* Effect.cached(getDevHubId(devHubUsername));
    const existingOrgInfo = yield* SubscriptionRef.get(defaultOrgRef);

    const updates = Object.fromEntries(
      Object.entries({
        orgId,
        devHubUsername,
        tracksSource,
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
  }).pipe(Effect.withSpan('updateDefaultOrgRef'));

/** for a given scratch org username, get the orgId of its devhub.  Requires the scratch org AND devhub to be authenticated locally */
const getDevHubId = (scratchOrgUsername?: string): Effect.Effect<string | undefined, Error> =>
  scratchOrgUsername
    ? Effect.promise(() => AuthInfo.create({ username: scratchOrgUsername })).pipe(
        Effect.map(authInfo => authInfo.getFields().orgId)
      )
    : Effect.succeed(undefined);
