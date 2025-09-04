/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';

export type ChannelService = {
  /** Get the OutputChannel for this ChannelService */
  readonly getChannel: Effect.Effect<vscode.OutputChannel, never, never>;
  /** Append a message to this OutputChannel */
  readonly appendToChannel: (message: string) => Effect.Effect<void, never, never>;
};
export const ChannelService = Context.GenericTag<ChannelService>('ChannelService');

const channelCache = new Map<string, vscode.OutputChannel>();

/**
 * Factory for a Layer that provides a ChannelService for the given channel name.
 * Usage:
 * Layer.provide(ChannelServiceLayer('My Channel'))
 */
export const ChannelServiceLayer = (channelName: string): Layer.Layer<ChannelService> =>
  Layer.effect(
    ChannelService,
    Effect.sync((): ChannelService => {
      const channel = getFromCacheOrCreate(channelName);
      return {
        getChannel: Effect.sync(() => channel),
        appendToChannel: (message: string) =>
          Effect.try({
            try: () => channel.appendLine(message),
            catch: e => new Error(`Failed to append to channel: ${String(e)}`)
          }).pipe(
            // channelLogging is "best effort" and will not cause a failure
            Effect.catchAll(() => Effect.succeed(undefined))
          )
      };
    })
  );

const getFromCacheOrCreate = (channelName: string): vscode.OutputChannel => {
  const existingChannel = channelCache.get(channelName);
  if (!existingChannel) {
    const newChannel = vscode.window.createOutputChannel(channelName);
    channelCache.set(channelName, newChannel);
  }
  return channelCache.get(channelName)!;
};
