/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Lifecycle } from '@salesforce/core/lifecycle';
import * as Effect from 'effect/Effect';
import { ChannelService } from '../vscode/channelService';

/**
 * Subscribes to @salesforce/core Lifecycle warnings and routes to output channel.
 * This prevents process.emitWarning from being called in web environments.
 */
export const subscribeLifecycleWarnings = () =>
  Effect.gen(function* () {
    const channelService = yield* ChannelService;

    Lifecycle.getInstance().onWarning(async (warning: string) => {
      await Effect.runPromise(channelService.appendToChannel(`[SFDX_CORE WARNING] ${warning}`));
    });
  }).pipe(Effect.withSpan('subscribeLifecycleWarnings'));
