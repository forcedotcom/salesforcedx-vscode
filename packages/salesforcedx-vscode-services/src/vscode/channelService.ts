/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { SERVICES_CHANNEL_NAME } from '../constants';

export class ChannelService extends Effect.Service<ChannelService>()('ChannelService', {
  sync: () => {
    // Default implementation with a generic channel name
    const channel = Effect.runSync(cache.get(SERVICES_CHANNEL_NAME));
    return {
      /** Get the OutputChannel for this ChannelService */
      getChannel: Effect.sync(() => channel),
      /** Append a message to this OutputChannel */
      appendToChannel: (message: string) =>
        Effect.try({
          try: () => channel.appendLine(message),
          catch: e => new Error(`Failed to append to channel: ${String(e)}`)
        }).pipe(
          // channelLogging is "best effort" and will not cause a failure
          Effect.catchAll(() => Effect.succeed(undefined))
        )
    } as const;
  }
}) {}

/**
 * Factory for a Layer that provides a ChannelService for the given channel name.
 * Use this in other extensions
 * Usage:
 * Layer.provide(ChannelServiceLayer('My Channel'))
 */
export const ChannelServiceLayer = (channelName: string): Layer.Layer<ChannelService> =>
  Layer.succeed(
    ChannelService,
    new ChannelService({
      getChannel: cache.get(channelName),
      appendToChannel: (message: string) =>
        Effect.gen(function* () {
          const channel = yield* cache.get(channelName);
          return yield* Effect.try({
            try: () => channel.appendLine(message),
            catch: e => new Error(`Failed to append to channel: ${String(e)}`)
          });
        }).pipe(
          // channelLogging is "best effort" and will not cause a failure
          Effect.catchAll(() => Effect.succeed(undefined))
        )
    })
  );

const cache = Effect.runSync(
  Cache.make({
    capacity: 100,
    timeToLive: Duration.infinity,
    lookup: (channelName: string) => Effect.sync(() => vscode.window.createOutputChannel(channelName))
  })
);
