/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type * as vscode from 'vscode';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';

/** Promise + resolver pair so the test can await the fire-and-forget fiber instead of guessing a delay. */
const createDeferred = () => {
  const parts = {} as { resolve: () => void; promise: Promise<void> };
  parts.promise = new Promise<void>(resolve => {
    parts.resolve = resolve;
  });
  return parts;
};

/**
 * Load the bridge from a fresh module graph with a mock AllServicesLayer already set.
 * getRuntime() memoizes the runtime (and the layer it was built from) at module level, so each case
 * needs its own graph; the tags are re-required from that graph to keep tag identity aligned.
 */
const loadBridgeWithMockLayer = () => {
  const calls: string[] = [];
  const shown = createDeferred();
  const loaded = {} as { appendAndShowChannelOutput: (message: string) => void };

  jest.isolateModules(() => {
    const { ExtensionProviderService } =
      require('@salesforce/effect-ext-utils') as typeof import('@salesforce/effect-ext-utils');
    const { ChannelService } =
      require('salesforcedx-vscode-services/src/vscode/channelService') as typeof import('salesforcedx-vscode-services/src/vscode/channelService');
    const { setAllServicesLayer } =
      require('../../../src/services/extensionProvider') as typeof import('../../../src/services/extensionProvider');

    const channelService = new ChannelService({
      getChannel: Effect.sync(() => ({ appendLine: jest.fn(), clear: jest.fn() }) as unknown as vscode.OutputChannel),
      showChannel: Effect.sync(() => {
        calls.push('show');
        shown.resolve();
      }),
      clearChannel: Effect.void,
      appendToChannel: (message: string) =>
        Effect.sync(() => {
          calls.push(`append:${message}`);
        })
    });

    setAllServicesLayer(
      Layer.mergeAll(
        Layer.succeed(ExtensionProviderService, {
          getServicesApi: Effect.succeed({ services: { ChannelService } } as unknown as SalesforceVSCodeServicesApi)
        }),
        Layer.succeed(ChannelService, channelService)
      ) as unknown as Parameters<typeof setAllServicesLayer>[0]
    );

    loaded.appendAndShowChannelOutput = (
      require('../../../src/channels') as typeof import('../../../src/channels')
    ).appendAndShowChannelOutput;
  });

  return { ...loaded, calls, shown };
};

describe('appendAndShowChannelOutput', () => {
  it('does not throw when no AllServicesLayer has been set', () => {
    jest.isolateModules(() => {
      const { appendAndShowChannelOutput } = require('../../../src/channels') as typeof import('../../../src/channels');
      // Channel output is fire-and-forget: pre-activation (or in unit tests) there is no layer/runtime,
      // and writeToDebuggerOutputWindow's callers must not see that as an exception.
      expect(() => appendAndShowChannelOutput('hello')).not.toThrow();
    });
  });

  it('appends the message to the services channel, then reveals it', async () => {
    const { appendAndShowChannelOutput, calls, shown } = loadBridgeWithMockLayer();

    appendAndShowChannelOutput('checkpoint failed');
    await shown.promise;

    expect(calls).toEqual(['append:checkpoint failed', 'show']);
  });
});
