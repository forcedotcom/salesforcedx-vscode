/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

export const resetRemoteTrackingCommand = Effect.fn('resetRemoteTracking')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, sourceTrackingService] = yield* Effect.all(
    [api.services.ChannelService, api.services.SourceTrackingService],
    { concurrency: 'unbounded' }
  );

  yield* channelService.appendToChannel('Resetting remote tracking...');

  const resetCount = yield* sourceTrackingService.resetRemoteTracking();

  yield* channelService.appendToChannel(
    `Successfully reset remote tracking. ${resetCount} file${resetCount === 1 ? '' : 's'} updated.`
  );
});
