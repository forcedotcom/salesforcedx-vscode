/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConnectionError } from './connectionService.js';
import type { QueryPageError } from './queryService.js';
import type {
  DebugLevelCreateError,
  DebugLevelDeleteError,
  TraceFlagCreateError,
  TraceFlagNotFoundError,
  TraceFlagUpdateError,
  UserIdNotFoundError
} from './traceFlagErrors.js';
import type { CreateDebugLevelPayload, DebugLevelItem, TraceFlagItem, TraceFlagLogType } from './traceFlagSchemas.js';
import * as Context from 'effect/Context';
import type * as Duration from 'effect/Duration';
import type * as Effect from 'effect/Effect';
import type * as Option from 'effect/Option';
import type * as PubSub from 'effect/PubSub';
import type * as Schema from 'effect/Schema';

export type TraceFlagReadError = ConnectionError | QueryPageError | Schema.SchemaError | TraceFlagNotFoundError;
export type TraceFlagWriteError =
  | TraceFlagReadError
  | TraceFlagCreateError
  | TraceFlagUpdateError
  | DebugLevelCreateError;
export class TraceFlagService extends Context.Service<
  TraceFlagService,
  {
    readonly getTraceFlags: () => Effect.Effect<TraceFlagItem[], TraceFlagReadError>;
    readonly getDebugLevels: () => Effect.Effect<readonly DebugLevelItem[], TraceFlagReadError>;
    readonly getTraceFlagForUser: (
      userId: string,
      logType?: TraceFlagLogType
    ) => Effect.Effect<Option.Option<TraceFlagItem>, TraceFlagReadError>;
    readonly createTraceFlag: (
      userId: string,
      debugLevelId: string,
      duration?: Duration.Input,
      logType?: TraceFlagLogType
    ) => Effect.Effect<string, ConnectionError | TraceFlagCreateError>;
    readonly updateTraceFlag: (
      id: string,
      options?: { readonly debugLevelId?: string; readonly expirationDate?: Date }
    ) => Effect.Effect<void, ConnectionError | TraceFlagUpdateError>;
    readonly deleteTraceFlag: (id: string) => Effect.Effect<void, ConnectionError | TraceFlagUpdateError>;
    readonly changeTraceFlagDebugLevel: (
      id: string,
      debugLevelId: string
    ) => Effect.Effect<void, ConnectionError | TraceFlagUpdateError>;
    readonly ensureTraceFlag: (
      userId: string,
      duration?: Duration.Input,
      logType?: TraceFlagLogType,
      existingDebugLevelId?: string
    ) => Effect.Effect<{ readonly created: boolean; readonly traceFlagId: string }, TraceFlagWriteError>;
    readonly cleanupExpired: () => Effect.Effect<
      boolean,
      TraceFlagReadError | TraceFlagUpdateError | UserIdNotFoundError
    >;
    readonly getOrCreateDebugLevel: () => Effect.Effect<string, TraceFlagReadError | DebugLevelCreateError>;
    readonly createDebugLevel: (
      payload: CreateDebugLevelPayload
    ) => Effect.Effect<string, ConnectionError | DebugLevelCreateError>;
    readonly deleteDebugLevel: (id: string) => Effect.Effect<void, ConnectionError | DebugLevelDeleteError>;
    readonly getUserId: () => Effect.Effect<string, UserIdNotFoundError>;
    readonly traceFlagsChanged: PubSub.PubSub<TraceFlagItem[]>;
  }
>()('@salesforce/vscode-services/v2/TraceFlagService') {}
