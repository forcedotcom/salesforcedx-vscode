/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { DefaultOrgInfoSchema } from './schemas/defaultOrgInfo';

// eslint-disable-next-line functional/no-let
let defaultOrgRef: SubscriptionRef.SubscriptionRef<typeof DefaultOrgInfoSchema.Type> | undefined;

export const getDefaultOrgRef = () => Effect.gen(function* () {
  defaultOrgRef ??= yield* SubscriptionRef.make<typeof DefaultOrgInfoSchema.Type>({});
  return defaultOrgRef;
});

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
