/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { AuthInfoFields } from './authFields.js';
import type { OrgId } from './defaultOrgInfo.js';
import type {
  AccessTokenExpiredError,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  SettingsError,
  GetAuthFieldsError,
  InactiveOrgOperationError,
  FailedToListAuthorizationsError
} from './errors.js';
import type { Connection, OrgAuthorization } from '@salesforce/core';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export type ConnectionError =
  | SettingsError
  | NoWorkspaceOpenError
  | FailedToCreateConfigAggregatorError
  | FailedToCreateAuthInfoError
  | FailedToCreateConnectionError
  | NoTargetOrgConfiguredError
  | AccessTokenExpiredError;

/** Authorization summary excludes credentials and CLI-only metadata. */
export type OrgAuthorizationSummary = Pick<
  OrgAuthorization,
  'username' | 'aliases' | 'isDevHub' | 'isSandbox' | 'isScratchOrg' | 'isExpired' | 'error'
>;

export class ConnectionService extends Context.Service<
  ConnectionService,
  {
    readonly getConnection: (username?: string) => Effect.Effect<Connection, ConnectionError>;
    readonly getConnectionForOrg: (
      expectedOrgId: OrgId
    ) => Effect.Effect<Connection, ConnectionError | InactiveOrgOperationError>;
    readonly getAuthInfoFields: (username?: string) => Effect.Effect<AuthInfoFields, GetAuthFieldsError>;
    readonly validateAccessTokenOrPromptReauth: (connection: Connection) => Effect.Effect<void, ConnectionError>;
    readonly invalidateCachedConnections: () => Effect.Effect<void>;
    readonly listAllAuthorizations: () => Effect.Effect<OrgAuthorizationSummary[], FailedToListAuthorizationsError>;
  }
>()('@salesforce/vscode-services-v2/ConnectionService') {}
