/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { EXTENSION_NAME } from '../constants';

/**
 * Centralized helper to check if conflict detection should be enabled.
 *
 * Returns true if conflict detection should run (default behavior).
 * Returns false if the user has disabled conflict detection via settings.
 *
 * This is the single source of truth for all conflict detection checks across:
 * - Status bar (startup, polling, file changes)
 * - Deploy commands
 * - Retrieve commands
 * - After metadata operations
 */
export const isConflictDetectionEnabled = Effect.fn('isConflictDetectionEnabled')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* (yield* api.services.SettingsService).getValueOrElse(
    EXTENSION_NAME,
    'sourceTracking.enableConflictDetection',
    true
  );
});
