/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { AllServicesLayer } from './services/extensionProvider';

/**
 * Gets a Connection to the target org using the Services extension.
 * This works in both web and desktop environments.
 */
export const getConnection = async (): Promise<Connection> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const svc = yield* api.services.ConnectionService;
      return yield* svc.getConnection;
    }).pipe(Effect.provide(AllServicesLayer))
  );
