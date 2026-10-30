/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConfigWriteError, FailedToCreateConfigAggregatorError, NoWorkspaceOpenError } from './errors.js';
import type { ConfigAggregator } from '@salesforce/core';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class ConfigService extends Context.Service<
  ConfigService,
  {
    readonly getTargetOrg: () => Effect.Effect<
      string | undefined,
      NoWorkspaceOpenError | FailedToCreateConfigAggregatorError
    >;
    readonly getConfigAggregator: () => Effect.Effect<
      ConfigAggregator,
      NoWorkspaceOpenError | FailedToCreateConfigAggregatorError
    >;
    readonly invalidateConfigAggregator: () => Effect.Effect<void>;
    readonly getTargetDevHub: () => Effect.Effect<
      string | undefined,
      NoWorkspaceOpenError | FailedToCreateConfigAggregatorError
    >;
    readonly isCliTelemetryDisabled: () => Effect.Effect<
      boolean,
      NoWorkspaceOpenError | FailedToCreateConfigAggregatorError
    >;
    readonly isCurrentTargetOrg: (
      username: string,
      aliases: readonly string[]
    ) => Effect.Effect<boolean, NoWorkspaceOpenError | FailedToCreateConfigAggregatorError>;
    readonly isCurrentTargetDevHub: (
      username: string,
      aliases: readonly string[]
    ) => Effect.Effect<boolean, NoWorkspaceOpenError | FailedToCreateConfigAggregatorError>;
    readonly setTargetOrg: (usernameOrAlias: string) => Effect.Effect<void, ConfigWriteError>;
    readonly unsetTargetOrg: () => Effect.Effect<void>;
    readonly unsetTargetDevHub: () => Effect.Effect<void>;
  }
>()('@salesforce/vscode-services-v2/ConfigService') {}
