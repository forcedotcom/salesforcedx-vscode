/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

export class ConnectionService extends Context.Service<ConnectionService, {
  readonly getConnection: () => Effect.Effect<string>;
}>()('ConnectionService') {
  public static readonly layer = Layer.succeed(this, { getConnection: () => Effect.succeed('v4') });
}

const runtime = ManagedRuntime.make(ConnectionService.layer);
export const connection = runtime.runSync(ConnectionService.use(service => service.getConnection()));
await runtime.dispose();
