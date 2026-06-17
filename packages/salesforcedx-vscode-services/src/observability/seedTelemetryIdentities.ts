/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { ExtensionContextService } from '../vscode/extensionContextService';
import { CliId, getCliId } from './cliTelemetry';
import { readGlobalStateKey } from './readGlobalStateKey';
import { TELEMETRY_GLOBAL_USER_ID, TELEMETRY_GLOBAL_WEB_USER_ID, UNAUTHENTICATED_USER } from './webUserId';

// crypto.randomUUID() returns a valid UUIDv4 — decode lifts it to the CliId brand.
const newRandomCliId = () => Schema.decode(CliId)(globalThis.crypto.randomUUID()).pipe(Effect.orDie);

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
  const existingOrgInfo = yield* SubscriptionRef.get(defaultOrgRef);
  yield* SubscriptionRef.set(defaultOrgRef, { ...existingOrgInfo, cliId, webUserId });
});
