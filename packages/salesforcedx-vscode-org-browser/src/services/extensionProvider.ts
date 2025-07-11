/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SalesforceVSCodeServicesApi } from '@salesforce/salesforcedx-vscode-services';
import { pipe, Effect } from 'effect';
import * as vscode from 'vscode';

/** Effect to get the Services extension instance */
const getServicesExtension = Effect.sync(() =>
  vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services')
).pipe(
  Effect.flatMap(extension =>
    !extension
      ? Effect.fail(new Error('Services extension not found'))
      : extension.isActive && !isSalesforceVSCodeServicesApi(extension.exports)
        ? Effect.fail(new Error('Invalid Services API'))
        : Effect.succeed(extension)
  )
);

const isSalesforceVSCodeServicesApi = (api: unknown): api is SalesforceVSCodeServicesApi =>
  api !== null && api !== undefined && typeof api === 'object' && 'telemetryService' in api;

/** Effect to get the Services API (activates extension if needed) */
export const getServicesApi = pipe(
  getServicesExtension,
  Effect.andThen(extension =>
    extension.isActive
      ? Effect.succeed(extension.exports)
      : Effect.tryPromise(async () => {
          const api = await extension.activate();
          if (!isSalesforceVSCodeServicesApi(api)) {
            throw new Error('Invalid Services API');
          }
          return api;
        })
  )
);

/** Effect to get the telemetry service specifically */
export const getTelemetryService = Effect.gen(function* () {
  const api = yield* getServicesApi;
  return api.telemetryService;
});

/** Effect to get the connection services */
export const getConnectionServices = Effect.gen(function* () {
  const api = yield* getServicesApi;
  return api.services;
});

/** Effect to initialize telemetry for a given context */
export const initializeTelemetry = (context: vscode.ExtensionContext): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    const telemetryService = yield* getTelemetryService;
    yield* Effect.tryPromise(() => telemetryService.initializeService(context));
  });
