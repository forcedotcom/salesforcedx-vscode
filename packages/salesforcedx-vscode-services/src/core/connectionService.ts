/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { Context, Effect, Layer, pipe } from 'effect';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';

// Use the actual connection type from sfdx-core
export type SalesforceConnection = Connection;

export type ConnectionService = {
  /** Get a Connection to the target org */
  readonly getConnection: Effect.Effect<SalesforceConnection, Error, ConfigService | WorkspaceService>;
};

export const ConnectionService = Context.GenericTag<ConnectionService>('ConnectionService');

export const ConnectionServiceLive = Layer.succeed(ConnectionService, {
  getConnection: pipe(
    ConfigService,
    Effect.flatMap(configService => configService.getConfigAggregator),
    Effect.tap(configAggregator =>
      console.log('ConfigAggregator', JSON.stringify(configAggregator.getConfig(), null, 2))
    ),
    Effect.flatMap(configAggregator => {
      const rawUsername = configAggregator.getPropertyValue('target-org');
      const username = typeof rawUsername === 'string' ? rawUsername : undefined;
      return username ? Effect.succeed(username) : Effect.fail(new Error('No default org (target-org) set in config'));
    }),
    Effect.flatMap(username =>
      Effect.tryPromise({
        try: () => AuthInfo.create({ username }),
        catch: error => new Error(`Failed to create AuthInfo: ${String(error)}`)
      })
    ),
    Effect.flatMap(authInfo =>
      Effect.tryPromise({
        try: () => Connection.create({ authInfo }),
        catch: error => new Error(`Failed to create Connection: ${String(error)}`)
      })
    )
  )
});
