/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect, Layer } from 'effect';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<SalesforceVSCodeServicesApi, Error, never>;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

const isSalesforceVSCodeServicesApi = (api: unknown): api is SalesforceVSCodeServicesApi =>
  api !== null && api !== undefined && typeof api === 'object' && 'services' in api;

export const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi: Effect.gen(function* () {
      const extension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services');
      if (!extension) return yield* Effect.fail(new Error('Services extension not found'));
      if (!extension.isActive) {
        const api = yield* Effect.tryPromise(() => extension.activate());
        if (!isSalesforceVSCodeServicesApi(api)) return yield* Effect.fail(new Error('Invalid Services API'));
        return api;
      }
      if (!isSalesforceVSCodeServicesApi(extension.exports))
        return yield* Effect.fail(new Error('Invalid Services API'));
      return extension.exports;
    })
  }))
);
