/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Random from 'effect/Random';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { ExtensionContextService } from '../vscode/extensionContextService';
import { CliId, getCliId } from './cliTelemetry';
import { readGlobalStateKey } from './readGlobalStateKey';
import { TELEMETRY_GLOBAL_USER_ID, TELEMETRY_GLOBAL_WEB_USER_ID, UNAUTHENTICATED_USER } from './webUserId';

const newRandomCliId = () =>
  Effect.all(Array.from({ length: 16 }, () => Random.nextIntBetween(0, 256))).pipe(
    Effect.map(bytes => {
      const hex = bytes
        .map((byte, index) =>
          (index === 6 ? (byte & 0x0f) | 0x40 : index === 8 ? (byte & 0x3f) | 0x80 : byte).toString(16).padStart(2, '0')
        )
        .join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }),
    Effect.flatMap(Schema.decode(CliId)),
    Effect.orDie
  );

const resolveCliIdFromCli = () =>
  process.env.ESBUILD_PLATFORM === 'web'
    ? newRandomCliId()
    : getCliId().pipe(Effect.flatMap(Option.match({ onSome: Effect.succeed, onNone: newRandomCliId })));

const decodeStoredCliId = (value: string) => Schema.decode(CliId)(value).pipe(Effect.orDie);

/**
 * Seed the stable cliId and webUserId identities into defaultOrgRef + globalState.
 * Must run before consumers (connectionService, core telemetry init) read identity state.
 */
export const seedTelemetryIdentities = Effect.fn('seedTelemetryIdentities')(function* () {
  const contextService = yield* ExtensionContextService;
  const extensionContext = yield* contextService.getContext;

  const existingCliId = yield* readGlobalStateKey(TELEMETRY_GLOBAL_USER_ID);
  const cliId = yield* Option.match(existingCliId, {
    onSome: decodeStoredCliId,
    onNone: resolveCliIdFromCli
  });

  if (Option.isNone(existingCliId)) {
    yield* Effect.promise(() => extensionContext.globalState.update(TELEMETRY_GLOBAL_USER_ID, cliId));
  }

  const existingWebUserId = yield* readGlobalStateKey(TELEMETRY_GLOBAL_WEB_USER_ID);
  const webUserId = Option.getOrElse(existingWebUserId, () => UNAUTHENTICATED_USER);
  if (Option.isNone(existingWebUserId)) {
    yield* Effect.promise(() => extensionContext.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, webUserId));
  }

  const defaultOrgRef = yield* getDefaultOrgRef();
  yield* SubscriptionRef.update(defaultOrgRef, existingOrgInfo => ({ ...existingOrgInfo, cliId, webUserId }));
});
