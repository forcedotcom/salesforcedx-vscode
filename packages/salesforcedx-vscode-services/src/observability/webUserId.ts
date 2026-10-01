/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { ExtensionContextService } from '../vscode/extensionContextService';

// Telemetry globalState keys (matching @salesforce/salesforcedx-utils-vscode constants — kept in sync; services owns its own copy to avoid taking on a utils dep).
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
export const setWebUserId = Effect.fn('setWebUserId')(function* (orgId: string, userId: string) {
  const contextService = yield* ExtensionContextService;
  const extensionContext = yield* contextService.getContext;
  const webUserId = yield* hashUserIdentifier(orgId, userId);

  yield* Effect.promise(() => extensionContext.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, webUserId));
  return webUserId;
});
