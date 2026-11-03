/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SalesforceVSCodeServicesApi } from './legacy/services.cjs';
import type * as Context from 'effect/Context';

/** Frozen V3 ABI; never derive these signatures from the migrated V4 implementation. */
export type LegacyServices = SalesforceVSCodeServicesApi['services'];
export type FullLegacyServicesApi = SalesforceVSCodeServicesApi;
export type LegacyServiceName = {
  [Name in keyof LegacyServices]: LegacyServices[Name] extends { readonly key: string } & (abstract new (
    ...args: never[]
  ) => object)
    ? Name
    : never;
}[keyof LegacyServices];
export type LegacyServiceConstructor<Name extends LegacyServiceName> = Extract<
  LegacyServices[Name],
  abstract new (...args: never[]) => object
>;
export type LegacyServiceBody<Name extends LegacyServiceName> = ConstructorParameters<
  LegacyServiceConstructor<Name>
>[0];
/** Preserve the frozen identifier even when an adapter's service body exposes only selected operations. */
export type LegacyServiceInstance<Name extends LegacyServiceName> = InstanceType<LegacyServiceConstructor<Name>>;
export type LegacyPrebuiltServices =
  LegacyServices['prebuiltServicesDependencies'] extends Context.Context<infer R> ? R : never;
export type LegacySharedServiceName = {
  [Name in LegacyServiceName]: LegacyServiceInstance<Name> extends LegacyPrebuiltServices ? Name : never;
}[LegacyServiceName];
