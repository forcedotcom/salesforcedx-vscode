/*
 * Copyright (c) 2025, salesforce.com, inc.
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

/** Get the user ID, preferring the cached TargetOrgRef before falling back to a connection */
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

  const connection = await getConnection();
  return connection.getAuthInfoFields().userId ?? (await connection.identity()).user_id;
};

/** Get auth fields from the workspace context */
export const getAuthFields = async (): Promise<AuthFields> => {
  const connection = await getConnection();
  return connection.getAuthInfoFields();
};
