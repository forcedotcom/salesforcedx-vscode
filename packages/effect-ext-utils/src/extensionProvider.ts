/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import type * as ParseResult from 'effect/ParseResult';
// Import from the npm package (symlinked in workspace) - wireit ensures it's compiled first
export type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import { type ExtensionActivationError, type ExtensionNotFoundError, getExtensionExports } from './extensionExports';

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<
    SalesforceVSCodeServicesApi,
    ExtensionNotFoundError | ExtensionActivationError | ParseResult.ParseError,
    never
  >;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

/** connect to the Salesforce Services extension and get all of its API services */
export const getServicesApi: ExtensionProviderService['getServicesApi'] = getExtensionExports({
  extId: 'salesforce.salesforcedx-vscode-services'
}).pipe(
  Effect.map(
    // This first-party extension is compiled against the same public type; retain the existing typed wrapper.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    exports => exports as SalesforceVSCodeServicesApi
  )
);
