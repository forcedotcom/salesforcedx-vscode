/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { getRuntime } from '../services/runtime';

const getConnection = () =>
  getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      return yield* api.services.ConnectionService.getConnection();
    })
  );

/** Get the user ID, preferring the cached TargetOrgRef before falling back to the org identity (owned data). */
export const getUserId = async (): Promise<string | undefined> => {
  const refUserId = await getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const ref = yield* api.services.TargetOrgRef();
      const { userId } = yield* SubscriptionRef.get(ref);
      return userId;
    })
  );
  if (refUserId) return refUserId;

  // Fallback resolves the user id from the org identity via the owned loan facade (no live Connection).
  // The PromisifiedContract mapping loses withDefaultOrg's generic, so the result is asserted to string.
  return getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const userId = yield* Effect.promise(() =>
        api.withDefaultOrg(org => org.identity().then(identity => identity.userId))
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return userId as string;
    })
  );
};

/**
 * Get auth fields from the workspace context.
 * @deprecated Returns @salesforce/core AuthFields (a 3pp shape) and is part of the published vscode-core 2PP API;
 * retained intentionally for backward compatibility. Internal callers should prefer owned data (W-22419571).
 */
export const getAuthFields = async (): Promise<AuthFields> => {
  const connection = await getConnection();
  return connection.getAuthInfoFields();
};
