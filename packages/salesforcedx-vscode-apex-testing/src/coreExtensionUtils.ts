/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { AllServicesLayer } from './services/extensionProvider';

export type DefaultOrgInfo = { orgId?: string; username?: string };

/**
 * Gets the current default org info from Services (defaultOrgRef).
 * Has orgId/username when a connection has been established; avoids file read for cache keys.
 */
export const getDefaultOrgInfo = async (): Promise<DefaultOrgInfo> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const ref = yield* api.services.TargetOrgRef();
      const current = yield* SubscriptionRef.get(ref);
      return { orgId: current.orgId, username: current.username };
    }).pipe(Effect.provide(AllServicesLayer))
  );

/**
 * Gets a Connection to the target org using the Services extension.
 * This works in both web and desktop environments.
 */
export const getConnection = async (): Promise<Connection> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      return yield* api.services.ConnectionService.getConnection();
    }).pipe(Effect.provide(AllServicesLayer))
  );
