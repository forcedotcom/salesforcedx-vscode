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
export { ConnectionService, type ConnectionError, type OrgAuthorizationSummary } from './connectionService.js';
export {
  AuthFields,
  authFieldsFrom,
  authFieldsFromConnection,
  orgIdFrom,
  orgIdFromConnection,
  type AuthInfoFields
} from './authFields.js';
export { TargetOrgRef } from './targetOrgRef.js';
export { WorkspaceService, type WorkspaceInfo, type WorkspaceWithFolder } from './workspaceService.js';
export { SettingsService, WebSessionContextSchema, type WebSessionContext } from './settingsService.js';
export { FsService, type FsProvider } from './fsService.js';
export { HashableUri } from './hashableUri.js';
export { FileChangePubSub, type FileChangeEvent } from './fileChangePubSub.js';
export { SettingsChangePubSub } from './settingsChangePubSub.js';
export { HostFileWatcher } from './hostFileWatcher.js';
export { ChannelService } from './channelService.js';
export { DefaultOrgInfoSchema, OrgId, SalesforceId, CliId, type DefaultOrgInfo } from './defaultOrgInfo.js';
export {
  AccessTokenExpiredError,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  SettingsError,
  ConfigWriteError,
  FsServiceError,
  HostFileNotFoundError,
  HostFileWatchError,
  FailedToSaveAuthInfoError,
  FailedToListAuthorizationsError,
  GetAuthFieldsError,
  InactiveOrgOperationError
} from './errors.js';
