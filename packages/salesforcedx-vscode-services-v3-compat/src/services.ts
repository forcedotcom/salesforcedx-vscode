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

const createApexLogTag: ReturnType<typeof Effect.Tag<'ApexLogService'>> = Effect.Tag('ApexLogService');
/** V4 owns QueryService; this V3 accessor delegates without requiring a V3 QueryService in the caller's Context. */
type LegacyLogList = ReturnType<LegacyServiceBody<'ApexLogService'>['listLogs']>;
type LegacyLogBody = ReturnType<LegacyServiceBody<'ApexLogService'>['getLogBody']>;
type CompatibleApexLogService = {
  readonly listLogs: (
    ...args: Parameters<LegacyServiceBody<'ApexLogService'>['listLogs']>
  ) => Effect.Effect<Effect.Effect.Success<LegacyLogList>, Effect.Effect.Error<LegacyLogList>, never>;
  readonly getLogBody: (
    ...args: Parameters<LegacyServiceBody<'ApexLogService'>['getLogBody']>
  ) => Effect.Effect<Effect.Effect.Success<LegacyLogBody>, Effect.Effect.Error<LegacyLogBody>, never>;
};
const ApexLogServiceBase: ReturnType<
  typeof createApexLogTag<LegacyServiceInstance<'ApexLogService'>, CompatibleApexLogService>
> = createApexLogTag<LegacyServiceInstance<'ApexLogService'>, CompatibleApexLogService>();
export class ApexLogService extends ApexLogServiceBase {}

const createFsTag: ReturnType<typeof Effect.Tag<'FsService'>> = Effect.Tag('FsService');
/** Keep the V3 filesystem operation required by Debug Log Analyzer; other Fs operations remain `/v2`-only. */
type LegacySafeWrite = ReturnType<LegacyServiceBody<'FsService'>['safeWriteFile']>;
type CompatibleFsService = {
  readonly safeWriteFile: (
    ...args: Parameters<LegacyServiceBody<'FsService'>['safeWriteFile']>
  ) => Effect.Effect<Effect.Effect.Success<LegacySafeWrite>, Effect.Effect.Error<LegacySafeWrite>, never>;
};
const FsServiceBase: ReturnType<typeof createFsTag<LegacyServiceInstance<'FsService'>, CompatibleFsService>> =
  createFsTag<LegacyServiceInstance<'FsService'>, CompatibleFsService>();
export class FsService extends FsServiceBase {}
