/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConnectionService, AliasService, ConfigService, getDefaultOrgRef } from './legacy/services.cjs';
import type * as Context from 'effect/Context';
import type * as Layer from 'effect/Layer';

/** External V3 subset; retain the frozen identifiers while restricting the public properties. */
export type SalesforceVSCodeServicesApi = {
  readonly services: {
    readonly ConnectionService: Pick<typeof ConnectionService, 'getConnection'>;
    readonly AliasService: Pick<typeof AliasService, 'getAliasesFromUsername'>;
    readonly ConfigService: Pick<typeof ConfigService, 'getTargetOrg'>;
    readonly TargetOrgRef: typeof getDefaultOrgRef;
    readonly prebuiltServicesDependencies: Context.Context<ConnectionService | AliasService | ConfigService>;
    readonly prebuiltServicesLayer: Layer.Layer<ConnectionService | AliasService | ConfigService>;
  };
};
