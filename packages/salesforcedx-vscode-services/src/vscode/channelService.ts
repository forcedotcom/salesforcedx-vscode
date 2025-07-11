/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Context, Effect, Layer } from 'effect';
import * as vscode from 'vscode';

export type ChannelService = {
  /** Get the OutputChannel for this ChannelService */
  readonly getChannel: Effect.Effect<vscode.OutputChannel, never, never>;
  /** Append a message to this OutputChannel */
  readonly appendToChannel: (message: string) => Effect.Effect<void, never, never>;
};
export const ChannelService = Context.GenericTag<ChannelService>('ChannelService');

/**
 * Factory for a Layer that provides a ChannelService for the given channel name.
 * Usage:
 * Layer.provide(ChannelServiceLayer('My Channel'))
 */
export const ChannelServiceLayer = (channelName: string): Layer.Layer<ChannelService> =>
  Layer.effect(
    ChannelService,
    Effect.sync((): ChannelService => {
      const channel = vscode.window.createOutputChannel(channelName);
      return {
        getChannel: Effect.sync(() => channel),
        appendToChannel: (message: string) => Effect.sync(() => channel.appendLine(message))
      };
    })
  );
