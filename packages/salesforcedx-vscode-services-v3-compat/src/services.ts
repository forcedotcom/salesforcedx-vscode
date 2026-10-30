/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConfigFailure, ConnectionFailure } from './serviceErrors.js';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';

// These are V3 interface keys. Their implementations are injected compatibility proxies, not defaults.
export class ConnectionService extends Effect.Tag('ConnectionService')<
  ConnectionService,
  {
    readonly getConnection: (username?: string) => Effect.Effect<Connection, ConnectionFailure>;
  }
>() {}

export class AliasService extends Effect.Tag('AliasService')<
  AliasService,
  {
    readonly getAliasesFromUsername: (username: string) => Effect.Effect<string[]>;
  }
>() {}

export class ConfigService extends Effect.Tag('ConfigService')<
  ConfigService,
  {
    readonly getTargetOrg: () => Effect.Effect<string | undefined, ConfigFailure>;
  }
>() {}
