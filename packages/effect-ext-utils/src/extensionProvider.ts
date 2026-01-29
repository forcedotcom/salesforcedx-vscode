/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

export class ServicesExtensionNotFoundError extends Data.TaggedError('ServicesExtensionNotFoundError') {}
export class InvalidServicesApiError extends Data.TaggedError('InvalidServicesApiError')<{ cause?: Error }> {}

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<
    SalesforceVSCodeServicesApi,
    ServicesExtensionNotFoundError | InvalidServicesApiError,
    never
  >;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

/** connect to the Salesforce Services extension and get all of its API services */
export const getServicesApi = Effect.sync(() =>
  vscode.extensions.getExtension<SalesforceVSCodeServicesApi>('salesforce.salesforcedx-vscode-services')
).pipe(
  Effect.flatMap(ext => (ext ? Effect.succeed(ext) : Effect.fail(new ServicesExtensionNotFoundError()))),
  Effect.flatMap(ext =>
    ext.isActive
      ? Effect.sync(() => ext.exports)
      : Effect.tryPromise({
          try: () => ext.activate(),
          catch: e => new InvalidServicesApiError(e instanceof Error ? { cause: e } : { cause: new Error(String(e)) })
        })
  )
);
