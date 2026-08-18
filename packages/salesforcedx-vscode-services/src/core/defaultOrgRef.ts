/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { DefaultOrgInfoSchema } from './schemas/defaultOrgInfo';

type TelemetryClassification = 'gov' | 'nonGov' | 'unknown';
export type TelemetryIdentitySnapshot = Readonly<
  Omit<typeof DefaultOrgInfoSchema.Type, 'instanceName'> & { telemetryClassification: TelemetryClassification }
>;

const govCloudInstanceNames: ReadonlySet<string> = new Set([
  'usa9402',
  'usa9404s',
  'usa9406s',
  'usa9902',
  'usa9904s',
  'usa9906s',
  'usa9914',
  'usa9916s',
  'usa9918s',
  'usa9002',
  'usa9004s',
  'usa9006s',
  'usa9008',
  'usa9010s',
  'usa9012s',
  'usa9014',
  'usa9016s',
  'usa9018s',
  'usa9020',
  'usa9022s',
  'usa9024s',
  'usa9026',
  'usa9028s'
]);

// eslint-disable-next-line functional/no-let
let defaultOrgRef: SubscriptionRef.SubscriptionRef<typeof DefaultOrgInfoSchema.Type> | undefined;

export const getDefaultOrgRef = Effect.fn('getDefaultOrgRef')(function* () {
  return (defaultOrgRef ??= yield* SubscriptionRef.make<typeof DefaultOrgInfoSchema.Type>({}));
});

export const getTelemetryIdentitySnapshot = (): TelemetryIdentitySnapshot => {
  const { instanceName, ...identity } = Effect.runSync(getDefaultOrgRef().pipe(Effect.flatMap(SubscriptionRef.get)));
  const telemetryClassification =
    identity.orgId && instanceName
      ? govCloudInstanceNames.has(instanceName.toLowerCase())
        ? 'gov'
        : 'nonGov'
      : 'unknown';
  return Object.freeze({ ...identity, telemetryClassification });
};

// preserves the webUserId and cliId when clearing the defaultOrgRef
export const clearDefaultOrgRef = Effect.fn('clearDefaultOrgRef')(function* () {
  const ref = yield* getDefaultOrgRef();
  yield* SubscriptionRef.update(ref, current => {
    const preserved = {
      ...(current.webUserId ? { webUserId: current.webUserId } : {}),
      ...(current.cliId ? { cliId: current.cliId } : {})
    };
    return preserved;
  });
});
