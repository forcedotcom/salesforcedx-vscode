/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';

/**
 * Load the bridge from a fresh module graph with a mock AllServicesLayer already set.
 * getRuntime() memoizes the runtime (and the layer it was built from) at module level, so each case
 * needs its own graph; the tags are re-required from that graph to keep tag identity aligned.
 */
const loadBridgeWithMockLayer = () => {
  const calls: string[] = [];
  // Resolver so the test awaits the fire-and-forget fiber instead of guessing a delay.
  const { promise: shown, resolve: channelShown } = Promise.withResolvers<void>();
  const loaded = {} as { writeToDebuggerOutputWindow: (message: string) => void };

  jest.isolateModules(() => {
    const { ExtensionProviderService } =
      require('@salesforce/effect-ext-utils') as typeof import('@salesforce/effect-ext-utils');
    const { ChannelService } =
      require('salesforcedx-vscode-services/src/vscode/channelService') as typeof import('salesforcedx-vscode-services/src/vscode/channelService');
    const { setAllServicesLayer } =
      require('../../../src/services/extensionProvider') as typeof import('../../../src/services/extensionProvider');

    const channel = {
      appendLine: jest.fn(),
      clear: jest.fn(),
      show: jest.fn((preserveFocus?: boolean) => {
        calls.push(`show:${preserveFocus}`);
        channelShown();
      })
    } as unknown as vscode.OutputChannel;

    const channelService = new ChannelService({
      getChannel: Effect.sync(() => channel),
      showChannel: Effect.sync(() => {
        calls.push('showChannel');
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

    loaded.writeToDebuggerOutputWindow = (
      require('../../../src/channels') as typeof import('../../../src/channels')
    ).writeToDebuggerOutputWindow;
  });

  return { ...loaded, calls, shown };
};

describe('writeToDebuggerOutputWindow', () => {
  it('creates no channel and does not throw when no AllServicesLayer has been set', () => {
    jest.isolateModules(() => {
      const { writeToDebuggerOutputWindow } =
        require('../../../src/channels') as typeof import('../../../src/channels');
      // Channel output is fire-and-forget: pre-activation (or in unit tests) there is no layer/runtime,
      // and writeToDebuggerOutputWindow's callers must not see that as an exception or a stray channel.
      expect(() => writeToDebuggerOutputWindow('hello')).not.toThrow();
      expect(vscode.window.createOutputChannel).not.toHaveBeenCalled();
    });
  });

  it('appends the message to the services channel, then reveals it without stealing focus', async () => {
    const { writeToDebuggerOutputWindow, calls, shown } = loadBridgeWithMockLayer();

    writeToDebuggerOutputWindow('checkpoint failed');
    await shown;

    // show(true) keeps keyboard focus in the editor, matching the legacy showChannelOutput()
    expect(calls).toEqual(['append:checkpoint failed', 'show:true']);
  });
});
