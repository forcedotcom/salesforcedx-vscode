/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';

const CHANNEL_NAME = nls.localize('channel_name');

// Shared channel instance - initialized during extension activation
let _outputChannel: vscode.OutputChannel | undefined;

/** Initialize the output channel from the services API. Call this during activation. */
export const initializeOutputChannel = Effect.gen(function* () {
  if (_outputChannel) return;

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  _outputChannel = yield* svc.getChannel;
});

/** Get the output channel. Must call initializeOutputChannel first during activation. */
const getOutputChannel = (): vscode.OutputChannel => {
  // Fallback if not initialized - this shouldn't happen in normal usage
  _outputChannel ??= vscode.window.createOutputChannel(CHANNEL_NAME);
  return _outputChannel;
};

// For backward compatibility with LibraryCommandletExecutor
// Uses a Proxy to defer access until after initialization
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const OUTPUT_CHANNEL: vscode.OutputChannel = new Proxy({} as vscode.OutputChannel, {
  get: (_target, prop: keyof vscode.OutputChannel) => {
    const channel = getOutputChannel();
    const value = channel[prop];
    return typeof value === 'function' ? value.bind(channel) : value;
  }
});

/** Channel service using the services API's ChannelServiceLayer */
export const channelService = {
  appendLine: async (message: string): Promise<void> => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const svc = yield* api.services.ChannelService;
        yield* svc.appendToChannel(message);
      }).pipe(Effect.provide(AllServicesLayer))
    );
  },
  show: async (): Promise<void> => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const svc = yield* api.services.ChannelService;
        const channel = yield* svc.getChannel;
        channel.show();
      }).pipe(Effect.provide(AllServicesLayer))
    );
  }
};
