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
import { getCliId } from './cliTelemetry';
import { TELEMETRY_GLOBAL_USER_ID, TELEMETRY_GLOBAL_WEB_USER_ID, UNAUTHENTICATED_USER } from './webUserId';

const newRandomCliId = () => Effect.sync(() => Schema.decodeSync(Schema.UUID)(globalThis.crypto.randomUUID()));

/**
 * Seed the stable cliId and webUserId identities into defaultOrgRef + globalState.
 * Must run before consumers (connectionService, core telemetry init) read identity state.
 */
export const seedTelemetryIdentities = Effect.fn('seedTelemetryIdentities')(function* () {
  const contextService = yield* ExtensionContextService;
  const extensionContext = yield* contextService.getContext;
  const defaultOrgRef = yield* getDefaultOrgRef();

  const existingCliId = Option.fromNullable(
    extensionContext.globalState.get<string | undefined>(TELEMETRY_GLOBAL_USER_ID)
  );
  const cliId = yield* Option.match(existingCliId, {
    onSome: id => Effect.succeed(id),
    onNone: () =>
      process.env.ESBUILD_PLATFORM === 'web'
        ? newRandomCliId()
        : getCliId().pipe(
            Effect.flatMap(
              Option.match({
                onSome: id => Effect.succeed(id),
                onNone: () => newRandomCliId()
              })
            )
          )
  });

  if (Option.isNone(existingCliId)) {
    yield* Effect.promise(() => extensionContext.globalState.update(TELEMETRY_GLOBAL_USER_ID, cliId));
  }

  const existingWebUserId = Option.fromNullable(
    extensionContext.globalState.get<string | undefined>(TELEMETRY_GLOBAL_WEB_USER_ID)
  );
  const webUserId = Option.getOrElse(existingWebUserId, () => UNAUTHENTICATED_USER);
  if (Option.isNone(existingWebUserId)) {
    yield* Effect.promise(() => extensionContext.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, webUserId));
  }

  const existingOrgInfo = yield* SubscriptionRef.get(defaultOrgRef);
  yield* SubscriptionRef.set(defaultOrgRef, { ...existingOrgInfo, cliId, webUserId });
});
