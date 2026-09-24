/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { ALL_EXCEPTION_CATCHER_ENABLED } from '../constants';

export const getEnableAllExceptionCatcher = Effect.fn('getEnableAllExceptionCatcher')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* (yield* api.services.SettingsService).getValueOrElse(
    SFDX_CORE_CONFIGURATION_NAME,
    ALL_EXCEPTION_CATCHER_ENABLED,
    false
  );
});
