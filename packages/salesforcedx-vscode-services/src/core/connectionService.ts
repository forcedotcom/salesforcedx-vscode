/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Global } from '@salesforce/core';
import { Cache, Context, Duration, Effect, Layer } from 'effect';
import { WebSdkLayer } from '../observability/spans';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';

// Use the actual connection type from sfdx-core
export type SalesforceConnection = Connection;

export type ConnectionService = {
  /** Get a Connection to the target org */
  readonly getConnection: Effect.Effect<
    SalesforceConnection,
    Error,
    ConfigService | WorkspaceService | SettingsService
  >;
};

export const ConnectionService = Context.GenericTag<ConnectionService>('ConnectionService');

type WebConnectionKey = {
  instanceUrl: string;
  accessToken: string;
};

const createWebConnection = ({ instanceUrl, accessToken }: WebConnectionKey): Effect.Effect<Connection, Error, never> =>
  Effect.tryPromise({
    try: async () =>
      Connection.create({
        authInfo: await AuthInfo.create({
          accessTokenOptions: { accessToken, loginUrl: instanceUrl, instanceUrl }
        })
      }),
    catch: error => new Error(`Failed to create Connection: ${String(error)}`)
  }).pipe(Effect.withSpan('createWebConnection', { attributes: { instanceUrl } }));

export const ConnectionServiceLive = Layer.scoped(
  ConnectionService,
  Effect.gen(function* () {
    // Create Effect's Cache for web connections with capacity and TTL
    const webConnectionCache = yield* Cache.make({
      capacity: 20, // Maximum number of cached web connections
      timeToLive: Duration.hours(2), // Connections expire after 2 hours (common token lifetime)
      lookup: createWebConnection // Lookup function that creates Connection for given credentials
    });

    return {
      getConnection: Effect.gen(function* () {
        if (Global.isWeb) {
          // Web environment - get connection from settings
          const settingsService = yield* SettingsService;
          const instanceUrl = yield* settingsService.getInstanceUrl;
          const accessToken = yield* settingsService.getAccessToken;

          return yield* webConnectionCache.get({ instanceUrl, accessToken });
        } else {
          // Desktop environment - use existing flow
          const configService = yield* ConfigService;
          const configAggregator = yield* configService.getConfigAggregator;
          console.log('ConfigAggregator', JSON.stringify(configAggregator.getConfig(), null, 2));

          const username = configAggregator.getPropertyValue<string>('target-org');

          if (!username) {
            return yield* Effect.fail(new Error('No default org (target-org) set in config'));
          }

          const authInfo = yield* Effect.tryPromise({
            try: () => AuthInfo.create({ username }),
            catch: error => new Error('Failed to create AuthInfo', { cause: error })
          });

          return yield* Effect.tryPromise({
            try: () => Connection.create({ authInfo }),
            catch: error => new Error('Failed to create Connection', { cause: error })
          });
        }
      })
        .pipe(Effect.withSpan('getConnection'))
        .pipe(Effect.provide(WebSdkLayer))
    };
  })
);
