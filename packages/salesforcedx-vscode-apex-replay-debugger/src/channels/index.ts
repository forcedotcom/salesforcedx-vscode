/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { getRuntime } from '../services/runtime';

const appendAndShow = Effect.fn('channels.appendAndShowChannelOutput')(function* (message: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(message);
  yield* channelService.showChannel;
});

/**
 * Fire-and-forget append to the services ChannelService, revealing the channel.
 * Guarded so channel output can never throw into its caller when the services runtime is not yet
 * available (e.g. before activation, or in unit tests where no layer has been set).
 */
export const appendAndShowChannelOutput = (message: string): void => {
  try {
    getRuntime().runFork(Effect.ignoreLogged(appendAndShow(message)));
  } catch {
    /* runtime not ready — drop the output */
  }
};
