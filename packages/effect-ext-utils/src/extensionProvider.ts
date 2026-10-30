/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
// Import from the npm package (symlinked in workspace) - wireit ensures it's compiled first
export type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import { getExtensionExports } from './extensionExports';

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
export const getServicesApi = getExtensionExports<SalesforceVSCodeServicesApi>(
  'salesforce.salesforcedx-vscode-services'
).pipe(
  Effect.catchTags({
    ExtensionNotFoundError: () => Effect.fail(new ServicesExtensionNotFoundError()),
    ExtensionActivationError: ({ cause }) =>
      Effect.fail(new InvalidServicesApiError({ cause: isError(cause) ? cause : new Error(String(cause)) }))
  })
);
