/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect, Layer, pipe } from 'effect';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<SalesforceVSCodeServicesApi, Error, never>;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

const isSalesforceVSCodeServicesApi = (api: unknown): api is SalesforceVSCodeServicesApi =>
  api !== null && api !== undefined && typeof api === 'object' && 'services' in api;

const getServicesApi = pipe(
  Effect.sync(() => vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services')),
  Effect.flatMap(extension =>
    extension ? Effect.succeed(extension) : Effect.fail(new Error('Services extension not found'))
  ),
  Effect.flatMap(extension =>
    extension.isActive ? Effect.sync(() => extension.exports) : Effect.tryPromise(() => extension.activate())
  ),
  Effect.flatMap(api =>
    isSalesforceVSCodeServicesApi(api) ? Effect.succeed(api) : Effect.fail(new Error('Invalid Services API'))
  )
);

export const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);
