/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { Context, Effect } from 'effect';

// Use the actual connection type from WorkspaceContextUtil
type SalesforceConnection = Awaited<ReturnType<typeof WorkspaceContextUtil.prototype.getConnection>>;

export type ConnectionService = {
  /** Get a Connection to the target org */
  readonly getConnection: Effect.Effect<SalesforceConnection, Error, never>;

  /** Check if a connection is available */
  readonly hasConnection: Effect.Effect<boolean, Error, never>;
};

export const ConnectionService = Context.GenericTag<ConnectionService>('ConnectionService');

export const ConnectionServiceLive = ConnectionService.of({
  getConnection: Effect.tryPromise({
    try: () => WorkspaceContextUtil.getInstance().getConnection(),
    catch: (error: unknown) => new Error(`Failed to get connection: ${String(error)}`)
  }),

  hasConnection: Effect.gen(function* () {
    try {
      yield* Effect.tryPromise({
        try: () => WorkspaceContextUtil.getInstance().getConnection(),
        catch: () => new Error('No connection available')
      });
      return true;
    } catch {
      return false;
    }
  })
});
