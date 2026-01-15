/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { getServicesApi } from './services/extensionProvider';

/**
 * Gets a Connection to the target org using the Services extension.
 * This works in both web and desktop environments.
 */
export const getConnection = async (): Promise<Connection> => {
  const servicesApi = await getServicesApi();
  // Provide all required dependencies for ConnectionService
  const connectionLayer = Layer.mergeAll(
    servicesApi.services.ConnectionService.Default,
    servicesApi.services.SettingsService.Default,
    servicesApi.services.ConfigService.Default,
    servicesApi.services.WorkspaceService.Default
  );
  return Effect.runPromise(
    servicesApi.services.ConnectionService.pipe(
      Effect.flatMap(service => service.getConnection),
      Effect.provide(connectionLayer)
    )
  );
};
