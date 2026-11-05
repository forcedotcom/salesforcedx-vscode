/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { LegacyServiceBody, LegacyServiceInstance } from './legacyTypes.js';
import * as Effect from 'effect/Effect';

// These are V3 interface keys. Their implementations are injected compatibility proxies, not defaults.
const createConnectionTag: ReturnType<typeof Effect.Tag<'ConnectionService'>> = Effect.Tag('ConnectionService');
const ConnectionServiceBase: ReturnType<
  typeof createConnectionTag<
    LegacyServiceInstance<'ConnectionService'>,
    Pick<LegacyServiceBody<'ConnectionService'>, 'getConnection'>
  >
> = createConnectionTag<
  LegacyServiceInstance<'ConnectionService'>,
  Pick<LegacyServiceBody<'ConnectionService'>, 'getConnection'>
>();
export class ConnectionService extends ConnectionServiceBase {}

const createAliasTag: ReturnType<typeof Effect.Tag<'AliasService'>> = Effect.Tag('AliasService');
const AliasServiceBase: ReturnType<
  typeof createAliasTag<
    LegacyServiceInstance<'AliasService'>,
    Pick<LegacyServiceBody<'AliasService'>, 'getAliasesFromUsername'>
  >
> = createAliasTag<
  LegacyServiceInstance<'AliasService'>,
  Pick<LegacyServiceBody<'AliasService'>, 'getAliasesFromUsername'>
>();
export class AliasService extends AliasServiceBase {}

const createConfigTag: ReturnType<typeof Effect.Tag<'ConfigService'>> = Effect.Tag('ConfigService');
const ConfigServiceBase: ReturnType<
  typeof createConfigTag<
    LegacyServiceInstance<'ConfigService'>,
    Pick<LegacyServiceBody<'ConfigService'>, 'getTargetOrg'>
  >
> = createConfigTag<LegacyServiceInstance<'ConfigService'>, Pick<LegacyServiceBody<'ConfigService'>, 'getTargetOrg'>>();
export class ConfigService extends ConfigServiceBase {}
