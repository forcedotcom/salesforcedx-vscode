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
    const tracked = (['disposal-a', 'disposal-b'] as const).map(name => ({ name, dispose: vi.fn() }));
    const disposers = Object.fromEntries(tracked.map(channel => [channel.name, channel.dispose]));

    vi.spyOn(vscode.window, 'createOutputChannel').mockImplementation(
      (name: string) =>
        ({
          appendLine: vi.fn(),
          show: vi.fn(),
          clear: vi.fn(),
          dispose: disposers[name]
        }) as unknown as vscode.LogOutputChannel
    );

    const loadChannel = (channelName: string) =>
      ChannelService.pipe(
        Effect.flatMap(service => service.getChannel),
        Effect.provide(ChannelServiceLayer(channelName))
      );

    const createCallsFor = (name: string): number =>
      vi.mocked(vscode.window.createOutputChannel).mock.calls.filter(([channelName]) => channelName === name).length;

    await Effect.forEach(tracked, channel => loadChannel(channel.name), { discard: true }).pipe(Effect.runPromise);

    expect(createCallsFor(tracked[0].name)).toBe(1);
    expect(createCallsFor(tracked[1].name)).toBe(1);

    const scope = await Scope.make().pipe(Effect.runPromise);
    await Layer.buildWithScope(ChannelDisposalLayer, scope).pipe(Effect.runPromise);

    expect(tracked[0].dispose).not.toHaveBeenCalled();
    expect(tracked[1].dispose).not.toHaveBeenCalled();

    await Scope.close(scope, Exit.void).pipe(Effect.runPromise);

    expect(tracked[0].dispose).toHaveBeenCalledTimes(1);
    expect(tracked[1].dispose).toHaveBeenCalledTimes(1);
  });
});
