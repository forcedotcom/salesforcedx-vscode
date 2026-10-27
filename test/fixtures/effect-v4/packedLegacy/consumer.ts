/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

// These are the actual generated, packed declarations, not fixture-provider types.
export const connect = (api: SalesforceVSCodeServicesApi) => Effect.runPromise(
  api.services.ConnectionService.getConnection().pipe(
    Effect.provide(Layer.succeedContext(api.services.prebuiltServicesDependencies))
  )
);
export const watchOrg = (api: SalesforceVSCodeServicesApi) => Effect.runPromise(api.services.TargetOrgRef());
