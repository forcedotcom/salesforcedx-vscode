/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import type { SalesforceVSCodeServicesApiV2 } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

export const connect = (api: SalesforceVSCodeServicesApiV2, username?: string): Promise<Connection> => Effect.runPromise(
  api.v2.services.ConnectionService.use(service => service.getConnection(username)).pipe(
    Effect.provide(Layer.succeedContext(api.v2.services.prebuiltServicesDependencies))
  )
);
export const watchOrg = (api: SalesforceVSCodeServicesApiV2) => api.v2.services.TargetOrgRef.pipe(
  Effect.flatMap(ref => SubscriptionRef.changes(ref).pipe(Stream.take(1), Stream.runCollect)),
  Effect.provide(api.v2.services.prebuiltServicesLayer),
  Effect.runPromise
);

export const invalidV3Accessor = (api: SalesforceVSCodeServicesApiV2) => {
  // @ts-expect-error V4 Context.Service has no generated V3 static accessor.
  return api.v2.services.ConnectionService.getConnection();
};
