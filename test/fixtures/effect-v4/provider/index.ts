/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';

// Frozen independently compiled protocol, not a second production service graph.
export type Connection = { readonly marker: string };
export class ConnectionService extends Effect.Tag('ConnectionService')<
  ConnectionService,
  { readonly getConnection: () => Effect.Effect<Connection> }
>() {}
export class AliasService extends Effect.Tag('AliasService')<
  AliasService,
  { readonly getAliasesFromUsername: (username: string) => Effect.Effect<readonly string[]> }
>() {}
export class ConfigService extends Effect.Tag('ConfigService')<
  ConfigService,
  { readonly getTargetOrg: () => Effect.Effect<string | undefined> }
>() {}

export const makeFixtureApi = (connection: Connection) => {
  const ref = Effect.runSync(SubscriptionRef.make<{ readonly orgId?: string }>({ orgId: 'initial' }));
  const context = Context.make(ConnectionService, { getConnection: () => Effect.succeed(connection) }).pipe(
    Context.add(AliasService, { getAliasesFromUsername: username => Effect.succeed([`${username}-alias`]) }),
    Context.add(ConfigService, { getTargetOrg: () => Effect.succeed('configured-alias') })
  );
  return {
    services: {
      ConnectionService,
      AliasService,
      ConfigService,
      TargetOrgRef: () => Effect.succeed(ref),
      prebuiltServicesDependencies: context,
      prebuiltServicesLayer: Layer.succeedContext(context)
    },
    setOrg: (orgId: string) => Effect.runPromise(SubscriptionRef.set(ref, { orgId }))
  };
};
