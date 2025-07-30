/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Global } from '@salesforce/core';
import { Context, Effect, Layer } from 'effect';
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

export const ConnectionServiceLive = Layer.succeed(ConnectionService, {
  getConnection: Effect.gen(function* () {
    if (Global.isWeb) {
      // Web environment - get connection from settings
      const settingsService = yield* SettingsService;
      const instanceUrl = yield* settingsService.getInstanceUrl;
      const accessToken = yield* settingsService.getAccessToken;

      if (!instanceUrl || !accessToken) {
        return yield* Effect.fail(new Error('No instanceUrl or accessToken found in settings'));
      }
      console.log('instanceUrl', instanceUrl);
      console.log('accessToken', accessToken);

      // For web environment, we need to use type assertion because the Connection.create
      // method's type definition doesn't account for the web environment parameters
      return yield* Effect.tryPromise({
        try: async () =>
          Connection.create({
            authInfo: await AuthInfo.create({
              accessTokenOptions: { accessToken, loginUrl: instanceUrl, instanceUrl }
            })
          }),
        catch: error => new Error(`Failed to create Connection: ${String(error)}`)
      });
    } else {
      // Desktop environment - use existing flow
      const configService = yield* ConfigService;
      const configAggregator = yield* configService.getConfigAggregator;
      console.log('ConfigAggregator', JSON.stringify(configAggregator.getConfig(), null, 2));

      const rawUsername = configAggregator.getPropertyValue('target-org');
      const username = typeof rawUsername === 'string' ? rawUsername : undefined;

      if (!username) {
        return yield* Effect.fail(new Error('No default org (target-org) set in config'));
      }

      const authInfo = yield* Effect.tryPromise({
        try: () => AuthInfo.create({ username }),
        catch: error => new Error(`Failed to create AuthInfo: ${String(error)}`)
      });

      return yield* Effect.tryPromise({
        try: () => Connection.create({ authInfo }),
        catch: error => new Error(`Failed to create Connection: ${String(error)}`)
      });
    }
  })
});
