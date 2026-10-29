/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  AccessTokenExpiredError,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  SettingsError
} from './errors.js';
import type { Connection } from '@salesforce/core';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class ConnectionService extends Context.Service<
  ConnectionService,
  {
    readonly getConnection: (
      username?: string
    ) => Effect.Effect<
      Connection,
      | SettingsError
      | NoWorkspaceOpenError
      | FailedToCreateConfigAggregatorError
      | FailedToCreateAuthInfoError
      | FailedToCreateConnectionError
      | NoTargetOrgConfiguredError
      | AccessTokenExpiredError
    >;
  }
>()('@salesforce/vscode-services-v2/ConnectionService') {}
