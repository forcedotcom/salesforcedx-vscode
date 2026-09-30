/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { ChannelDisposalLayer, ChannelService, ChannelServiceLayer } from '../../../src/vscode/channelService';

describe('ChannelDisposalLayer', () => {
  it('disposes each cached output channel when its scope closes', async () => {
    const tracked = (['disposal-a', 'disposal-b'] as const).map(name => ({ name, dispose: jest.fn() }));
    const disposers = Object.fromEntries(tracked.map(channel => [channel.name, channel.dispose]));

    jest.spyOn(vscode.window, 'createOutputChannel').mockImplementation(
      (name: string) =>
        ({
          appendLine: jest.fn(),
          show: jest.fn(),
          clear: jest.fn(),
          dispose: disposers[name]
        }) as unknown as vscode.LogOutputChannel
    );

    const loadChannel = (channelName: string) =>
      ChannelService.pipe(
        Effect.flatMap(service => service.getChannel),
        Effect.provide(ChannelServiceLayer(channelName))
      );

    const createCallsFor = (name: string): number =>
      jest.mocked(vscode.window.createOutputChannel).mock.calls.filter(([channelName]) => channelName === name).length;

    await Effect.runPromise(Effect.forEach(tracked, channel => loadChannel(channel.name), { discard: true }));

    expect(createCallsFor(tracked[0].name)).toBe(1);
    expect(createCallsFor(tracked[1].name)).toBe(1);

    const scope = await Effect.runPromise(Scope.make());
    await Effect.runPromise(Layer.buildWithScope(ChannelDisposalLayer, scope));

    expect(tracked[0].dispose).not.toHaveBeenCalled();
    expect(tracked[1].dispose).not.toHaveBeenCalled();

    await Effect.runPromise(Scope.close(scope, Exit.void));

    expect(tracked[0].dispose).toHaveBeenCalledTimes(1);
    expect(tracked[1].dispose).toHaveBeenCalledTimes(1);

    await Effect.runPromise(Effect.forEach(tracked, channel => loadChannel(channel.name), { discard: true }));

    expect(createCallsFor(tracked[0].name)).toBe(2);
    expect(createCallsFor(tracked[1].name)).toBe(2);
  });
});
