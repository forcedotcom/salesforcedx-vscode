/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Global } from '@salesforce/core';
import { Context, Duration, Effect, Layer, Cache } from 'effect';
import { SdkLayer } from '../observability/spans';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';

export type ConnectionService = {
  /** Get a Connection to the target org */
  readonly getConnection: Effect.Effect<Connection, Error, ConfigService | WorkspaceService | SettingsService>;
};

export const ConnectionService = Context.GenericTag<ConnectionService>('ConnectionService');

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
    Effect.withSpan('createAuthInfo'),
    Effect.provide(SdkLayer)
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

export const ConnectionServiceLive = Layer.effect(
  ConnectionService,
  Effect.gen(function* () {
    return {
      getConnection: Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({ isWeb: Global.isWeb });
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
            Effect.flatMap(agg => Effect.succeed(agg.getPropertyValue<string>('target-org'))),
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
      }).pipe(Effect.provide(SdkLayer), Effect.withSpan('getConnection'))
    };
  })
);
