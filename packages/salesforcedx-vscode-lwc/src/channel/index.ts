/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { getRuntime } from '../services/runtime';

/** Resolve ChannelService from the services runtime (lazy — called only after setAllServicesLayer). */
const getChannelService = () =>
  getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      return yield* api.services.ChannelService;
    })
  );

let _channelService: Awaited<ReturnType<typeof getChannelService>> | undefined;

/** Fire-and-forget log to the services ChannelService. Safe to call at any point after setAllServicesLayer. */
export const appendToChannel = (message: string): void => {
  if (_channelService) {
    getRuntime().runFork(_channelService.appendToChannel(message));
    return;
  }
  void getChannelService().then(svc => {
    _channelService = svc;
    getRuntime().runFork(svc.appendToChannel(message));
  });
};

/** Adapter satisfying `Pick<OutputChannel, 'appendLine'>` for APIs that need it (e.g. registerWorkspaceReadFileHandler). */
export const channelAdapter = { appendLine: appendToChannel };
