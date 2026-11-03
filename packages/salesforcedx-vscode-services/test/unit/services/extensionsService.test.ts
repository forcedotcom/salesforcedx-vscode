/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { ExtensionsService, ExtensionsServiceLayer } from '../../../src/services/extensionsService.js';

let installed: string[];
let changed: () => void;
const disposeListener = vi.fn();
beforeEach(() => {
  installed = ['salesforce.first'];
  Object.defineProperty(vscode.extensions, 'all', { configurable: true, get: () => installed.map(id => ({ id })) });
  vi.mocked(vscode.extensions.onDidChange).mockImplementation(listener => {
    changed = () => {
      listener(undefined);
    };
    return { dispose: disposeListener };
  });
});

it('takes the native initial snapshot and publishes updates before the native callback returns', async () => {
  const runtime = ManagedRuntime.make(ExtensionsServiceLayer);
  try {
    const service = await runtime.runPromise(ExtensionsService);
    expect([...(await runtime.runPromise(service.get))]).toEqual(['salesforce.first']);
    expect(await runtime.runPromise(service.isInstalled('salesforce.first'))).toBe(true);
    const ready = Promise.withResolvers<void>();
    const collecting = runtime.runPromise(
      service.changes.pipe(
        Stream.tap(() => Effect.sync(() => ready.resolve())),
        Stream.take(2),
        Stream.runCollect
      )
    );
    await ready.promise;
    installed = ['salesforce.second'];
    changed();
    expect([...(await runtime.runPromise(service.get))]).toEqual(['salesforce.second']);
    expect((await collecting).map(ids => [...ids])).toEqual([['salesforce.first'], ['salesforce.second']]);
    expect(await runtime.runPromise(service.isInstalled('salesforce.first'))).toBe(false);
  } finally {
    await runtime.dispose();
  }
  expect(disposeListener).toHaveBeenCalledTimes(1);
});

it('replays only the current snapshot to late subscribers', async () => {
  const runtime = ManagedRuntime.make(ExtensionsServiceLayer);
  try {
    const service = await runtime.runPromise(ExtensionsService);
    installed = ['latest'];
    changed();
    const latest = await runtime.runPromise(service.get);
    const samples = await runtime.runPromise(service.changes.pipe(Stream.take(1), Stream.runCollect));
    expect(samples).toHaveLength(1);
    expect(samples[0]).toBe(latest);
  } finally {
    await runtime.dispose();
  }
});

it('captures changes made while installing the native listener', async () => {
  vi.mocked(vscode.extensions.onDidChange).mockImplementationOnce(() => {
    installed = ['installed-during-registration'];
    return { dispose: disposeListener };
  });
  const runtime = ManagedRuntime.make(ExtensionsServiceLayer);
  try {
    expect([...(await runtime.runPromise(ExtensionsService.use(service => service.get)))]).toEqual([
      'installed-during-registration'
    ]);
  } finally {
    await runtime.dispose();
  }
});

it('closes streams, rejects late reads, and ignores late host callbacks after disposal', async () => {
  const runtime = ManagedRuntime.make(ExtensionsServiceLayer);
  const service = await runtime.runPromise(ExtensionsService);
  const ready = Promise.withResolvers<void>();
  const collecting = Effect.runPromiseExit(
    service.changes.pipe(
      Stream.tap(() => Effect.sync(() => ready.resolve())),
      Stream.runDrain
    )
  );
  await ready.promise;
  await runtime.dispose();
  expect(Exit.isSuccess(await collecting)).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(service.get))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(service.isInstalled('late')))).toBe(true);
  const snapshotReads = vi.spyOn(vscode.extensions, 'all', 'get');
  snapshotReads.mockClear();
  expect(() => {
    installed = ['late'];
    changed();
  }).not.toThrow();
  expect(snapshotReads).not.toHaveBeenCalled();
  snapshotReads.mockRestore();
  expect(disposeListener).toHaveBeenCalledTimes(1);
});

it('shares one snapshot/listener with multiple owners using the same memo map', async () => {
  const memoMap = Layer.makeMemoMapUnsafe();
  const first = ManagedRuntime.make(ExtensionsServiceLayer, { memoMap });
  const second = ManagedRuntime.make(ExtensionsServiceLayer, { memoMap });
  try {
    const a = await first.runPromise(ExtensionsService);
    const b = await second.runPromise(ExtensionsService);
    expect(a).toBe(b);
    expect(vscode.extensions.onDidChange).toHaveBeenCalledTimes(1);
    await first.dispose();
    expect(disposeListener).not.toHaveBeenCalled();
    installed = ['still active'];
    changed();
    expect([...(await second.runPromise(b.get))]).toEqual(['still active']);
  } finally {
    await first.dispose();
    await second.dispose();
  }
  expect(disposeListener).toHaveBeenCalledTimes(1);
});

it('retains native listener-disposal defects without leaving subscribers running', async () => {
  const defect = new Error('listener cleanup failed');
  disposeListener.mockImplementationOnce(() => {
    throw defect;
  });
  const runtime = ManagedRuntime.make(ExtensionsServiceLayer);
  const service = await runtime.runPromise(ExtensionsService);
  const ready = Promise.withResolvers<void>();
  const stream = Effect.runPromiseExit(
    service.changes.pipe(
      Stream.tap(() => Effect.sync(() => ready.resolve())),
      Stream.runDrain
    )
  );
  await ready.promise;
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit))
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
  expect(Exit.isSuccess(await stream)).toBe(true);
});
