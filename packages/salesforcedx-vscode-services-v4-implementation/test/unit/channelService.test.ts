/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as vscode from 'vscode';
import { ChannelServiceLayer } from '../../src/channelService.js';

it('shares one actual host output channel and disposes it once for the owning graph', async () => {
  const runtime = ManagedRuntime.make(Layer.mergeAll(ChannelServiceLayer, ChannelServiceLayer));
  const service = await runtime.runPromise(ChannelService);
  const channel = await runtime.runPromise(service.getChannel);
  expect(vscode.window.createOutputChannel).toHaveBeenCalledExactlyOnceWith('Salesforce Services');
  await runtime.runPromise(service.appendToChannel('Metadata describe completed'));
  await runtime.runPromise(service.showChannel);
  expect(channel.appendLine).toHaveBeenCalledWith('Metadata describe completed');
  expect(channel.show).toHaveBeenCalledTimes(1);
  await runtime.dispose();
  expect(channel.dispose).toHaveBeenCalledTimes(1);
  expect(Exit.isFailure(await Effect.runPromiseExit(service.appendToChannel('late')))).toBe(true);
  expect(channel.appendLine).toHaveBeenCalledTimes(1);
});

it('preserves best-effort channel append/clear without hiding scope cleanup failures', async () => {
  const runtime = ManagedRuntime.make(ChannelServiceLayer);
  const service = await runtime.runPromise(ChannelService);
  const channel = await runtime.runPromise(service.getChannel);
  vi.mocked(channel.appendLine).mockImplementationOnce(() => {
    throw new Error('append failed');
  });
  vi.mocked(channel.clear).mockImplementationOnce(() => {
    throw new Error('clear failed');
  });
  await runtime.runPromise(service.appendToChannel('best effort'));
  await runtime.runPromise(service.clearChannel);
  const defect = new Error('dispose failed');
  vi.mocked(channel.dispose).mockImplementationOnce(() => {
    throw defect;
  });
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(
    Exit.isFailure(exit) && exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)
  ).toBe(true);
});
