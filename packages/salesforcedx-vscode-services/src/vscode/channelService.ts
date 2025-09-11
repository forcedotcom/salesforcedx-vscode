/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';

const channelCache = new Map<string, vscode.OutputChannel>();

export class ChannelService extends Effect.Service<ChannelService>()('ChannelService', {
  sync: () => {
    // Default implementation with a generic channel name
    const channel = getFromCacheOrCreate('Salesforce');
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
 * Usage:
 * Layer.provide(ChannelServiceLayer('My Channel'))
 */
export const ChannelServiceLayer = (channelName: string): Layer.Layer<ChannelService> =>
  Layer.succeed(
    ChannelService,
    new ChannelService({
      getChannel: Effect.sync(() => getFromCacheOrCreate(channelName)),
      appendToChannel: (message: string) =>
        Effect.try({
          try: () => getFromCacheOrCreate(channelName).appendLine(message),
          catch: e => new Error(`Failed to append to channel: ${String(e)}`)
        }).pipe(
          // channelLogging is "best effort" and will not cause a failure
          Effect.catchAll(() => Effect.succeed(undefined))
        )
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
