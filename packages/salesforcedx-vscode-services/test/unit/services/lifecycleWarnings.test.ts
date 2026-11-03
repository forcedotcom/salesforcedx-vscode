/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Lifecycle } from '@salesforce/core/lifecycle';
import { ChannelService } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Scheduler from 'effect/Scheduler';
import * as vscode from 'vscode';
import type { MockInstance } from 'vitest';
import { setImmediate } from 'node:timers/promises';
import { LifecycleWarningsLayer } from '../../../src/core/lifecycleWarningListener';
import { ChannelServiceLayer } from '../../../src/services/channelService';
import { ServiceOperations, ServiceOperationsLayer } from '../../../src/services/serviceOperations';

const makeChannel = () =>
  ({
    name: 'Services',
    append: vi.fn(),
    appendLine: vi.fn(),
    clear: vi.fn(),
    replace: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn()
  }) satisfies vscode.OutputChannel;
const channels: ReturnType<typeof makeChannel>[] = [];
beforeEach(() => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  channels.length = 0;
  const createChannel: MockInstance = vi.mocked(vscode.window.createOutputChannel);
  createChannel.mockImplementation(() => {
    const channel = makeChannel();
    channels.push(channel);
    return channel;
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const makeLayer = () =>
  LifecycleWarningsLayer.pipe(Layer.provideMerge(Layer.merge(ChannelServiceLayer, ServiceOperationsLayer)));
const makeRuntime = () => ManagedRuntime.make(makeLayer());

it('does not install native warning dispatch on desktop', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  const onWarning = vi.spyOn(Lifecycle.getInstance(), 'onWarning');
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(Effect.void);
    expect(onWarning).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it('coexists with later ordinary SDK listeners without duplicate service delivery', async () => {
  const runtime = makeRuntime();
  const other = vi.fn(async () => undefined);
  try {
    await runtime.runPromise(Effect.void);
    Lifecycle.getInstance().onWarning(other);
    await Lifecycle.getInstance().emitWarning('one warning');
    expect(other).toHaveBeenCalledExactlyOnceWith('one warning');
    expect(channels[0]?.appendLine).toHaveBeenCalledExactlyOnceWith('[SFDX_CORE WARNING] one warning');
  } finally {
    await runtime.dispose();
  }
});

it('releases the old graph and reuses one native bridge on cached-module reactivation', async () => {
  const first = makeRuntime();
  await first.runPromise(Effect.void);
  const count = Lifecycle.getInstance().getListeners(Lifecycle.warningEventName).length;
  await first.dispose();
  const second = makeRuntime();
  try {
    await second.runPromise(Effect.void);
    expect(Lifecycle.getInstance().getListeners(Lifecycle.warningEventName)).toHaveLength(count);
    await Lifecycle.getInstance().emitWarning('reactivated');
    expect(channels[0]?.appendLine).not.toHaveBeenCalled();
    expect(channels[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(channels[1]?.appendLine).toHaveBeenCalledExactlyOnceWith('[SFDX_CORE WARNING] reactivated');
  } finally {
    await second.dispose();
  }
});

it('rejects an overlapping independent owner without disconnecting the first', async () => {
  const first = makeRuntime();
  const second = makeRuntime();
  try {
    await first.runPromise(Effect.void);
    const result = await second.runPromiseExit(Effect.void);
    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure')
      expect(
        result.cause.reasons.some(
          reason => reason._tag === 'Fail' && reason.error._tag === 'LifecycleWarningOwnerError'
        )
      ).toBe(true);
    await second.dispose();
    await Lifecycle.getInstance().emitWarning('first remains');
    expect(channels[0]?.appendLine).toHaveBeenCalledExactlyOnceWith('[SFDX_CORE WARNING] first remains');
  } finally {
    await second.dispose();
    await first.dispose();
  }
});

it('admits only one concurrent independent owner with scheduler yielding forced between Effect steps', async () => {
  const layer = makeLayer().pipe(Layer.provide(Layer.succeed(Scheduler.MaxOpsBeforeYield, 8)));
  const first = ManagedRuntime.make(layer);
  const second = ManagedRuntime.make(layer);
  try {
    const results = await Promise.all([first.runPromiseExit(Effect.void), second.runPromiseExit(Effect.void)]);
    expect(results.filter(result => result._tag === 'Success')).toHaveLength(1);
    expect(results.filter(result => result._tag === 'Failure')).toHaveLength(1);
    await Lifecycle.getInstance().emitWarning('one concurrent owner');
    expect(channels.flatMap(channel => channel.appendLine.mock.calls)).toEqual([
      ['[SFDX_CORE WARNING] one concurrent owner']
    ]);
  } finally {
    await first.dispose();
    await second.dispose();
  }
});

it('ignores only owner-shutdown interruption and releases late native warnings without touching the channel', async () => {
  const runtime = makeRuntime();
  await runtime.runPromise(Effect.void);
  const operations = await runtime.runPromise(ServiceOperations);
  await Effect.runPromise(operations.close);
  await Lifecycle.getInstance().emitWarning('admission closed');
  expect(channels[0]?.appendLine).not.toHaveBeenCalled();
  await runtime.dispose();
  await Lifecycle.getInstance().emitWarning('scope closed');
  expect(channels[0]?.appendLine).not.toHaveBeenCalled();
});

it.each([false, true])('does not swallow a channel defect, including mixed interruption: %s', async mixed => {
  const defect = new Error('channel failed');
  const runtime = ManagedRuntime.make(
    LifecycleWarningsLayer.pipe(
      Layer.provideMerge(
        Layer.merge(
          Layer.mock(ChannelService, {
            appendToChannel: () =>
              Effect.failCause(mixed ? Cause.combine(Cause.die(defect), Cause.interrupt()) : Cause.die(defect))
          }),
          ServiceOperationsLayer
        )
      )
    )
  );
  try {
    await runtime.runPromise(Effect.void);
    await expect(Lifecycle.getInstance().emitWarning('defect')).rejects.toThrow('channel failed');
  } finally {
    await runtime.dispose();
  }
});

it('attaches native warning dispatch to the owner scope and joins slow cleanup during disposal', async () => {
  const started = Promise.withResolvers<void>();
  const finalizing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const runtime = ManagedRuntime.make(
    LifecycleWarningsLayer.pipe(
      Layer.provideMerge(
        Layer.merge(
          Layer.mock(ChannelService, {
            appendToChannel: () =>
              Effect.sync(() => started.resolve()).pipe(
                Effect.andThen(Effect.never),
                Effect.ensuring(
                  Effect.promise(() => {
                    finalizing.resolve();
                    return release.promise;
                  })
                )
              )
          }),
          ServiceOperationsLayer
        )
      )
    )
  );
  await runtime.runPromise(Effect.void);
  let emitted = false;
  const emitting = Lifecycle.getInstance()
    .emitWarning('pending')
    .then(() => {
      emitted = true;
    });
  await started.promise;
  let disposed = false;
  const closing = runtime.dispose().then(() => {
    disposed = true;
  });
  try {
    await finalizing.promise;
    await setImmediate();
    expect(disposed).toBe(false);
    expect(emitted).toBe(false);
  } finally {
    release.resolve();
  }
  await closing;
  await emitting;
});
