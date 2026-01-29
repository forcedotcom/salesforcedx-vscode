/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';

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
