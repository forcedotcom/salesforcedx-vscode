/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

const APEX_TESTING_CONFIGURATION_NAME = 'salesforcedx-vscode-apex-testing';

export const retrieveTestCodeCoverage = Effect.fn('retrieveTestCodeCoverage')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* (yield* api.services.SettingsService).getValueOrElse(
    APEX_TESTING_CONFIGURATION_NAME,
    'retrieve-test-code-coverage',
    false
  );
});
