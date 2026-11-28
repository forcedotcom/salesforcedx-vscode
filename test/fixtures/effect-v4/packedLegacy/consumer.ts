/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SalesforceVSCodeServicesApi, ICONS } from '@salesforce/vscode-services';
// @ts-expect-error Internal schema declarations are not part of the external root subset.
import { DefaultOrgInfoSchema } from '@salesforce/vscode-services';
// @ts-expect-error Internal error helpers are not part of the external root subset.
import { GetAuthFieldsError } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

// These are the actual generated, packed declarations, not fixture-provider types.
export const connect = (api: SalesforceVSCodeServicesApi) => Effect.runPromise(
  api.services.ConnectionService.getConnection().pipe(
    Effect.provide(Layer.succeedContext(api.services.prebuiltServicesDependencies))
  )
);
export const watchOrg = (api: SalesforceVSCodeServicesApi) => Effect.runPromise(api.services.TargetOrgRef());

export const icon = ICONS.SF_DEFAULT_ORG;
// @ts-expect-error The API declaration is type-only, never a runtime export.
export const invalidApiValue = SalesforceVSCodeServicesApi;
export const subsetControls = (api: SalesforceVSCodeServicesApi) => {
  // @ts-expect-error Unmigrated first-party services are private, not external root members.
  api.services.QueryService;
  // @ts-expect-error External Connection exposes only the audited operation.
  api.services.ConnectionService.getConnectionForOrg('00D000000000001');
  // @ts-expect-error External Alias exposes only the audited operation.
  api.services.AliasService.getAllAliases();
};
void DefaultOrgInfoSchema;
void GetAuthFieldsError;
