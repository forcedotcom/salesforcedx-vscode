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
const loadBridgeWithMockLayer = async () => {
  const calls: string[] = [];
  // Resolver so the test awaits the fire-and-forget fiber instead of guessing a delay.
  const { promise: shown, resolve: channelShown } = Promise.withResolvers<void>();
  vi.resetModules();
  const freshVscode = await import('vscode');
  const { ExtensionProviderService } = await import('@salesforce/effect-ext-utils');
  const { ChannelService } = await import('salesforcedx-vscode-services/out/src/vscode/channelService.js');
  const { setAllServicesLayer } = await import('../../../src/services/extensionProvider.js');

  const channel = {
    appendLine: vi.fn(),
    clear: vi.fn(),
    show: vi.fn((preserveFocus?: boolean) => {
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

  const { writeToDebuggerOutputWindow } = await import('../../../src/channels/index.js');

  return { writeToDebuggerOutputWindow, calls, shown, freshVscode };
};

describe('writeToDebuggerOutputWindow', () => {
  beforeEach(() => {
    vi.mocked(vscode.window.showErrorMessage).mockClear();
    vi.mocked(vscode.window.showWarningMessage).mockClear();
  });

  it('creates no channel and does not throw when no AllServicesLayer has been set', async () => {
    vi.resetModules();
    const { writeToDebuggerOutputWindow } = await import('../../../src/channels/index.js');
    // Channel output is fire-and-forget: pre-activation (or in unit tests) there is no layer/runtime,
    // and writeToDebuggerOutputWindow's callers must not see that as an exception or a stray channel.
    expect(() => writeToDebuggerOutputWindow('hello')).not.toThrow();
    expect(vscode.window.createOutputChannel).not.toHaveBeenCalled();
  });

  it('appends the message to the services channel, then reveals it without stealing focus', async () => {
    const { writeToDebuggerOutputWindow, calls, shown } = await loadBridgeWithMockLayer();

    writeToDebuggerOutputWindow('checkpoint failed');
    await shown;

    // show(true) keeps keyboard focus in the editor, matching the legacy showChannelOutput()
    expect(calls).toEqual(['append:checkpoint failed', 'show:true']);
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('shows an error toast when windowType is error', async () => {
    const { writeToDebuggerOutputWindow, shown, freshVscode } = await loadBridgeWithMockLayer();

    writeToDebuggerOutputWindow('checkpoint failed', 'error');
    await shown;

    expect(freshVscode.window.showErrorMessage).toHaveBeenCalledWith('checkpoint failed');
    expect(freshVscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('shows a warning toast when windowType is warning', async () => {
    const { writeToDebuggerOutputWindow, shown, freshVscode } = await loadBridgeWithMockLayer();

    writeToDebuggerOutputWindow('upload in progress', 'warning');
    await shown;

    expect(freshVscode.window.showWarningMessage).toHaveBeenCalledWith('upload in progress');
    expect(freshVscode.window.showErrorMessage).not.toHaveBeenCalled();
  });
});
