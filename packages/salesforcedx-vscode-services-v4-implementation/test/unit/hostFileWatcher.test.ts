/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import coreFs from '@salesforce/core/fs';
import { HostFileWatcher } from '@salesforce/vscode-services-v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Stream from 'effect/Stream';
import * as TestClock from 'effect/testing/TestClock';
import { mkdtemp, rm } from 'node:fs/promises';
import type * as NodeFs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HostFileSystem } from '../../src/hostFileSystem.js';
import { HostFileWatcherLayer } from '../../src/hostFileWatcher.js';

afterEach(() => vi.unstubAllEnvs());

it.each(['node', 'memfs'])('observes %s files and closes the real backend watcher once', async backend => {
  vi.stubEnv('FORCE_MEMFS', backend === 'memfs' ? 'true' : 'false');
  vi.stubEnv('ESBUILD_PLATFORM', backend === 'memfs' ? 'web' : 'node');
  const fileSystem = coreFs.getVirtualFs();
  const directory =
    backend === 'node' ? await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sf-v4-watch-')) : '/sf-v4-watch';
  await fileSystem.promises.mkdir(directory, { recursive: true });
  const filePath = backend === 'node' ? join(directory, 'config.json') : `${directory}/config.json`;
  await fileSystem.promises.writeFile(filePath, '{}');
  const started = Promise.withResolvers<void>();
  const handles: NodeFs.FSWatcher[] = [];
  const close = vi.fn();
  const watchFile = fileSystem.watch as typeof NodeFs.watch;
  const watch = vi.fn((path: NodeFs.PathLike, listener: NodeFs.WatchListener<string>) => {
    const handle = watchFile(path, listener);
    const originalClose = handle.close.bind(handle);
    vi.spyOn(handle, 'close').mockImplementation(() => {
      close();
      return originalClose();
    });
    handles.push(handle);
    started.resolve();
    return handle;
  });
  const layer = HostFileWatcherLayer.pipe(
    Layer.provide(
      Layer.succeed(HostFileSystem, {
        get: () => ({ watch })
      })
    )
  );
  const changes = Effect.runFork(
    HostFileWatcher.use(service => service.watch(filePath).pipe(Stream.take(1), Stream.runCollect)).pipe(
      Effect.provide(layer),
      Effect.timeout(Duration.seconds(4))
    )
  );
  try {
    await started.promise;
    await fileSystem.promises.writeFile(filePath, '{"changed":true}');
    const result = await Effect.runPromise(Fiber.join(changes));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'change', uri: { scheme: backend === 'memfs' ? 'memfs' : 'file' } });
    expect(watch).toHaveBeenCalledTimes(1);
    expect(handles).toHaveLength(1);
  } finally {
    await Effect.runPromise(Fiber.interrupt(changes));
    if (backend === 'node') await rm(directory, { recursive: true, force: true });
  }
  expect(close).toHaveBeenCalledTimes(1);
});

it('does not retry a non-ENOENT host error', async () => {
  const error = Object.assign(new Error('permission denied'), { code: 'EACCES' });
  const watch = vi.fn(() => {
    throw error;
  });
  const layer = HostFileWatcherLayer.pipe(
    Layer.provide(
      Layer.succeed(HostFileSystem, {
        get: () => ({ ...coreFs.fs, watch })
      })
    )
  );
  expect(
    await Effect.runPromise(
      HostFileWatcher.use(service => service.watch('/denied').pipe(Stream.runDrain, Effect.flip)).pipe(
        Effect.provide(layer)
      )
    )
  ).toMatchObject({
    _tag: 'HostFileWatchError',
    path: '/denied',
    code: 'EACCES',
    message: 'permission denied'
  });
  expect(watch).toHaveBeenCalledTimes(1);
});

it('uses a backend installed after layer acquisition instead of a stale SDK filesystem snapshot', async () => {
  const previous = coreFs.fs;
  vi.stubEnv('FORCE_MEMFS', 'true');
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const replacement = coreFs.getVirtualFs();
  await replacement.promises.mkdir('/replacement', { recursive: true });
  await replacement.promises.writeFile('/replacement/config.json', '{}');
  const started = Promise.withResolvers<void>();
  const watchFile = replacement.watch as typeof NodeFs.watch;
  const watch = vi.fn((path: NodeFs.PathLike, listener: NodeFs.WatchListener<string>) => {
    const watcher = watchFile(path, listener);
    started.resolve();
    return watcher;
  });
  const runtime = ManagedRuntime.make(HostFileWatcherLayer);
  await runtime.runPromise(Effect.void);
  coreFs.setFs({ ...replacement, watch });
  const changes = runtime.runFork(
    HostFileWatcher.use(service =>
      service.watch('/replacement/config.json').pipe(Stream.take(1), Stream.runCollect)
    ).pipe(Effect.timeout(Duration.seconds(4)))
  );
  try {
    await started.promise;
    await replacement.promises.writeFile('/replacement/config.json', '{"changed":true}');
    expect(await Effect.runPromise(Fiber.join(changes))).toMatchObject([{ type: 'change', uri: { scheme: 'memfs' } }]);
    expect(watch).toHaveBeenCalledTimes(1);
  } finally {
    await Effect.runPromise(Fiber.interrupt(changes));
    await runtime.dispose();
    coreFs.setFs(previous);
  }
});

it('retries ENOENT after exactly the existing 250ms backoff', async () => {
  const missing = Object.assign(new Error('missing'), { code: 'ENOENT' });
  const handle = { close: vi.fn(), on: vi.fn() };
  handle.on.mockReturnValue(handle);
  type Watch = ReturnType<(typeof HostFileSystem)['Service']['get']>['watch'];
  const watch = vi
    .fn<Watch>()
    .mockImplementationOnce(() => {
      throw missing;
    })
    .mockReturnValue(handle as unknown as NodeFs.FSWatcher);
  const layer = HostFileWatcherLayer.pipe(Layer.provide(Layer.succeed(HostFileSystem, { get: () => ({ watch }) })));
  await Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* HostFileWatcher.use(service => service.watch('/later').pipe(Stream.runDrain)).pipe(
        Effect.forkChild
      );
      yield* TestClock.adjust(Duration.millis(249));
      expect(watch).toHaveBeenCalledTimes(1);
      yield* TestClock.adjust(Duration.millis(1));
      expect(watch).toHaveBeenCalledTimes(2);
      yield* Fiber.interrupt(fiber);
      expect(handle.close).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(layer), Effect.provide(TestClock.layer()))
  );
});
