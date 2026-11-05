/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import crossSpawn from 'cross-spawn';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as ChildProcess from 'effect/process/ChildProcess';
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner';
import * as Stream from 'effect/Stream';
import { ChildProcess as NativeChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import {
  CrossSpawnChildProcessSpawnerLayer,
  resolveCommandEnv
} from '../../../src/services/crossSpawnChildProcessSpawner.js';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));

const native = () => {
  const handle = new NativeChildProcess();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  Object.assign(handle, { pid: 123, stdout, stderr });
  const kill = vi.spyOn(handle, 'kill').mockReturnValue(true);
  vi.mocked(crossSpawn).mockReturnValue(handle);
  return { handle, stdout, stderr, kill };
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const spawn = (command: ChildProcess.Command = ChildProcess.make('sf', ['org', 'display'])) =>
  ChildProcessSpawner.use(service => service.spawn(command));

it('merges ambient env and caller overlay without losing PATH', () => {
  vi.stubEnv('PROCESS_TEST_PARENT', 'parent');
  const env = resolveCommandEnv({ SF_JSON_TO_STDOUT: 'true', PROCESS_TEST_PARENT: 'override' });
  expect(env).toMatchObject({ PROCESS_TEST_PARENT: 'override', SF_JSON_TO_STDOUT: 'true' });
  expect(env.PATH).toBe(process.env.PATH);
  expect(resolveCommandEnv(undefined).PROCESS_TEST_PARENT).toBe('parent');
});

it.each([
  ChildProcess.make('sf', [], { shell: true }),
  ChildProcess.make('sf').pipe(ChildProcess.pipeTo(ChildProcess.make('cat')))
])('rejects shell/pipeline descriptions before native spawn', async command => {
  expect(
    await Effect.runPromise(
      spawn(command).pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer), Effect.flip)
    )
  ).toMatchObject({
    _tag: 'PlatformError',
    reason: { _tag: 'BadArgument' }
  });
  expect(crossSpawn).not.toHaveBeenCalled();
});

it('owns a child before the spawn event, waits for close on interruption, and removes listeners', async () => {
  const { handle, stdout, stderr, kill } = native();
  const controller = new AbortController();
  const acquired = Promise.withResolvers<void>();
  const killed = Promise.withResolvers<void>();
  kill.mockImplementation(() => {
    killed.resolve();
    return true;
  });
  vi.mocked(crossSpawn).mockImplementationOnce(() => {
    acquired.resolve();
    return handle;
  });
  let returned = false;
  const running = Effect.runPromiseExit(
    spawn(ChildProcess.make('sf', ['x ; echo bad'], { cwd: '/space path', env: { EXTRA: 'x' } })).pipe(
      Effect.scoped,
      Effect.provide(CrossSpawnChildProcessSpawnerLayer)
    ),
    { signal: controller.signal }
  ).then(result => {
    returned = true;
    return result;
  });
  await acquired.promise;
  controller.abort();
  await killed.promise;
  // Give the Effect/Promise settlement callbacks a turn before withholding native close.
  await setImmediate();
  expect(returned).toBe(false);
  expect(crossSpawn).toHaveBeenCalledWith(
    'sf',
    ['x ; echo bad'],
    expect.objectContaining({ cwd: '/space path', shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
  );
  expect(vi.mocked(crossSpawn).mock.calls[0]?.[2]?.env).toMatchObject({ EXTRA: 'x', PATH: process.env.PATH });
  stdout.end();
  stderr.end();
  handle.emit('close', null, 'SIGTERM');
  const exit = await running;
  expect(Exit.isFailure(exit)).toBe(true);
  expect(kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
  expect(handle.listenerCount('spawn')).toBe(0);
  expect(handle.listenerCount('error')).toBe(0);
  expect(handle.listenerCount('close')).toBe(0);
});

it('waits for native close after an error before spawn and sanitizes its details', async () => {
  const { handle, kill } = native();
  const failed = Promise.withResolvers<void>();
  const running = Effect.runPromise(
    spawn().pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer), Effect.flip)
  );
  handle.emit('error', Object.assign(new Error('secret-executable secret-arg'), { code: 'ENOENT' }));
  failed.resolve();
  await failed.promise;
  handle.emit('close', -2, null);
  const error = await running;
  expect(error).toMatchObject({ _tag: 'PlatformError', reason: { _tag: 'NotFound', method: 'spawn' } });
  expect(JSON.stringify(error)).not.toContain('secret');
  expect(kill.mock.calls.length).toBeLessThanOrEqual(1);
  expect(handle.listenerCount('error')).toBe(0);
});

it('does not discard final output delivered after exit but before close', async () => {
  const { handle, stdout, stderr, kill } = native();
  const consuming = Promise.withResolvers<void>();
  const running = Effect.runPromise(
    Effect.gen(function* () {
      const child = yield* spawn();
      consuming.resolve();
      return yield* Effect.all(
        [
          child.stdout.pipe(Stream.decodeText(), Stream.mkString),
          child.stderr.pipe(Stream.decodeText(), Stream.mkString),
          child.exitCode
        ],
        { concurrency: 3 }
      );
    }).pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer))
  );
  handle.emit('spawn');
  await consuming.promise;
  handle.emit('exit', 0, null);
  stdout.end('tail 👋');
  stderr.end('warning');
  handle.emit('close', 0, null);
  expect(await running).toEqual(['tail 👋', 'warning', 0]);
  expect(kill).not.toHaveBeenCalled();
  expect(handle.listenerCount('error')).toBe(0);
});

it('maps signal termination to a typed exit failure instead of a zero exit', async () => {
  const { handle } = native();
  const consuming = Promise.withResolvers<void>();
  const running = Effect.runPromise(
    Effect.gen(function* () {
      const child = yield* spawn();
      consuming.resolve();
      return yield* child.exitCode;
    }).pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer), Effect.flip)
  );
  handle.emit('spawn');
  await consuming.promise;
  handle.emit('close', null, 'SIGTERM');
  expect(await running).toMatchObject({ _tag: 'PlatformError', reason: { method: 'exitCode' } });
});

it('observes stream failures and still joins native close during release', async () => {
  const { handle, stdout, stderr, kill } = native();
  const started = Promise.withResolvers<void>();
  const running = Effect.runPromise(
    Effect.gen(function* () {
      const child = yield* spawn();
      started.resolve();
      return yield* Stream.runDrain(child.stdout);
    }).pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer), Effect.flip)
  );
  handle.emit('spawn');
  await started.promise;
  stdout.destroy(new Error('stream secret'));
  stderr.end();
  handle.emit('close', 0, null);
  expect(await running).toMatchObject({ _tag: 'PlatformError', reason: { method: 'fromReadable' } });
  expect(handle.listenerCount('error')).toBe(0);
  expect(kill.mock.calls.length).toBeLessThanOrEqual(1);
});

it('preserves a synchronous cross-spawn failure as a typed error', async () => {
  vi.mocked(crossSpawn).mockImplementationOnce(() => {
    throw Object.assign(new Error('private'), { code: 'ENOENT' });
  });
  expect(
    await Effect.runPromise(
      spawn().pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer), Effect.flip)
    )
  ).toMatchObject({ _tag: 'PlatformError', reason: { _tag: 'NotFound' } });
});

it('supports explicit kill signal and force-kill fallback without returning before close', async () => {
  const { handle, kill } = native();
  const killed = Promise.withResolvers<void>();
  kill.mockImplementation(signal => {
    if (signal === 'SIGKILL') {
      handle.emit('close', null, 'SIGKILL');
      killed.resolve();
    }
    return true;
  });
  const running = Effect.runPromise(
    Effect.gen(function* () {
      const child = yield* spawn();
      yield* child.kill({ killSignal: 'SIGINT', forceKillAfter: Duration.millis(1) });
    }).pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer))
  );
  handle.emit('spawn');
  await killed.promise;
  await running;
  expect(kill.mock.calls).toEqual([['SIGINT'], ['SIGKILL']]);
});
