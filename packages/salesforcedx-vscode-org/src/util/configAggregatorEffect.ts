/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { Effect } from 'effect';

/** Get ConfigAggregator Effect for the current workspace */
export const getConfigAggregatorEffect = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const configService = yield* api.services.ConfigService;
  return yield* configService.getConfigAggregator();
});
