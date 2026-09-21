/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import {
  CORE_CONFIG_SECTION,
  DEPLOY_ON_SAVE_ENABLED,
  DEPLOY_ON_SAVE_IGNORE_CONFLICTS,
  DETECT_CONFLICTS_FOR_DEPLOY_AND_RETRIEVE
} from '../constants';

/** Check if deploy on save is enabled */
export const getDeployOnSaveEnabled = Effect.fn('getDeployOnSaveEnabled')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.SettingsService.getValueOrElse(CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED, false);
});

/** Check if conflicts should be ignored during deploy on save */
export const getIgnoreConflicts = Effect.fn('getIgnoreConflicts')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.SettingsService.getValueOrElse(
    CORE_CONFIG_SECTION,
    DEPLOY_ON_SAVE_IGNORE_CONFLICTS,
    false
  );
});

/** Check if conflict detection is enabled for deploy/retrieve on non-tracking orgs (reads from core for backward compat). Tracking orgs always check. */
export const getDetectConflictsForDeployAndRetrieve = Effect.fn('getDetectConflictsForDeployAndRetrieve')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.SettingsService.getValueOrElse(
    CORE_CONFIG_SECTION,
    DETECT_CONFLICTS_FOR_DEPLOY_AND_RETRIEVE,
    false
  );
});
