/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getExtensionContext } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { ExtensionContext } from 'vscode';
import {  getDefaultOrgRef } from '../core/defaultOrgRef';
import { DefaultOrgInfoSchema } from '../core/schemas/defaultOrgInfo';

// Telemetry globalState keys (matching @salesforce/salesforcedx-utils-vscode constants)
export const TELEMETRY_GLOBAL_USER_ID = 'telemetryUserId';
export const TELEMETRY_GLOBAL_WEB_USER_ID = 'telemetryWebUserId';
export const UNAUTHENTICATED_USER = 'UNAUTHENTICATED_USER';

/**
 * Creates a one-way hash of orgId and userId for telemetry compliance.
 * This ensures customer data cannot be decoded while maintaining user distinction.
 * The result is stored in the "webUserId" field for telemetry purposes.
 */
const hashUserIdentifier = (orgId: string, userId: string) =>
  Effect.promise(async () => {
    const data = new TextEncoder().encode(`${orgId}-${userId}`);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  });

// persist the webUserId to the extension context global state
export const setWebUserId = (orgId: string, userId: string) =>
  Effect.gen(function* () {
    const extensionContext = yield* getExtensionContext();
    const webUserId = yield* hashUserIdentifier(orgId, userId);

    yield* Effect.promise(() => extensionContext.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, webUserId));
    return webUserId;
  });

/** Updates telemetry user IDs (userId and webUserId) in defaultOrgRef from ExtensionContext globalState */
export const updateTelemetryUserIds = Effect.fn('updateTelemetryUserIds')(function* (
  extensionContext: ExtensionContext
) {
  const userId = extensionContext.globalState.get<string | undefined>(TELEMETRY_GLOBAL_USER_ID);
  const webUserId = extensionContext.globalState.get<string | undefined>(TELEMETRY_GLOBAL_WEB_USER_ID);

  const existingOrgInfo = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
  const updated = {
    ...existingOrgInfo,
    ...(userId ? { userId } : {}),
    ...(webUserId ? { webUserId } : {})
  };

  // Only update if values actually changed
  if (!Schema.equivalence(DefaultOrgInfoSchema)(updated, existingOrgInfo)) {
    yield* SubscriptionRef.set(yield* getDefaultOrgRef(), updated);
  }
});
