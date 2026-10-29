/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { AliasService } from './aliasService.js';
import type { ConfigService } from './configService.js';
import type { ConnectionService } from './connectionService.js';
import type { TargetOrgRef } from './targetOrgRef.js';
import type * as Context from 'effect/Context';
import type * as Layer from 'effect/Layer';

/** Initial contract; activation exposes this only after live V4 service binding. */
export type SalesforceVSCodeServicesApiV2 = {
  readonly v2: {
    readonly services: {
      readonly ConnectionService: typeof ConnectionService;
      readonly AliasService: typeof AliasService;
      readonly ConfigService: typeof ConfigService;
      readonly TargetOrgRef: typeof TargetOrgRef;
      readonly prebuiltServicesDependencies: Context.Context<
        ConnectionService | AliasService | ConfigService | TargetOrgRef
      >;
      readonly prebuiltServicesLayer: Layer.Layer<ConnectionService | AliasService | ConfigService | TargetOrgRef>;
    };
  };
};

export { AliasService } from './aliasService.js';
export { ConfigService } from './configService.js';
export { ConnectionService } from './connectionService.js';
export { TargetOrgRef } from './targetOrgRef.js';
export { DefaultOrgInfoSchema, OrgId, SalesforceId, CliId, type DefaultOrgInfo } from './defaultOrgInfo.js';
export {
  AccessTokenExpiredError,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  SettingsError
} from './errors.js';
