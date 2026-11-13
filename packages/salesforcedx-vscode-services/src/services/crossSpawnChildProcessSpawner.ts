/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import crossSpawn from 'cross-spawn';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PlatformError from 'effect/PlatformError';
import { isError, isNotNull, isNull, isUndefined } from 'effect/Predicate';
import type * as ChildProcess from 'effect/process/ChildProcess';
import * as ChildProcessSpawner from 'effect/process/ChildProcessSpawner';
import * as Redacted from 'effect/Redacted';
import * as Sink from 'effect/Sink';
import * as Stream from 'effect/Stream';
import type { Readable } from 'node:stream';

/** Keep PATH and the ambient environment when applying a caller's overlay. */
export const resolveCommandEnv = (overlay: ChildProcess.CommandOptions['env']): NodeJS.ProcessEnv => ({
  ...process.env,
  ...Object.fromEntries(
    Object.entries(overlay ?? {}).map(([name, value]) => [
      name,
      isUndefined(value) ? undefined : typeof value === 'string' ? value : Redacted.value(value)
    ])
  )
});
const systemError = (error: unknown, method: string) =>
  PlatformError.systemError({
    _tag: isError(error) && 'code' in error && error.code === 'ENOENT' ? 'NotFound' : 'Unknown',
    module: 'ChildProcess',
    method
  });
const fromReadable = (readable: Readable | null) =>
  isNull(readable)
    ? Stream.empty
    : Stream.fromAsyncIterable<Uint8Array, PlatformError.PlatformError>(readable, error =>
        systemError(error, 'fromReadable')
      );

const acquireProcess = (command: ChildProcess.StandardCommand) =>
  Effect.try({
    try: () => {
      const args = command.args.map(argument => (typeof argument === 'string' ? argument : Redacted.value(argument)));
      const handle = crossSpawn(command.command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: command.options.cwd,
        env: resolveCommandEnv(command.options.env),
        shell: false
      });
      // Native callback handshakes never reject: a failed spawn cannot create an unhandled Promise.
      const ready = Promise.withResolvers<PlatformError.PlatformError | undefined>();
      const closed = Promise.withResolvers<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>();
      const closedState = { didClose: false };
      const onError = (error: unknown) => ready.resolve(systemError(error, 'spawn'));
      const onSpawn = () => ready.resolve(undefined);
      const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
        closedState.didClose = true;
        closed.resolve({ code, signal });
      };
      handle.on('error', onError);
      handle.once('spawn', onSpawn);
      handle.once('close', onClose);
      return {
        handle,
        ready: ready.promise,
        closed: closed.promise,
        isClosed: () => closedState.didClose,
        removeListeners: () => {
          handle.off('error', onError);
          handle.off('spawn', onSpawn);
          handle.off('close', onClose);
        }
      };
    },
    catch: error => systemError(error, 'spawn')
  });
const terminate = Effect.fn('CrossSpawnChildProcessSpawner.terminate')(function* (
  process: Effect.Success<ReturnType<typeof acquireProcess>>,
  options?: ChildProcess.KillOptions
) {
  yield* Effect.sync(() => {
    if (!process.isClosed()) process.handle.kill(options?.killSignal ?? 'SIGTERM');
  });
  const closed = Effect.promise(() => process.closed).pipe(Effect.asVoid);
  return yield* options?.forceKillAfter === undefined
    ? closed
    : closed.pipe(
        Effect.timeoutOrElse({
          duration: options.forceKillAfter,
          orElse: () =>
            Effect.sync(() => {
              if (!process.isClosed()) process.handle.kill('SIGKILL');
            }).pipe(Effect.andThen(closed))
        })
      );
});

/** cross-spawn retains Windows .cmd resolution; resource ownership begins before awaiting the spawn event. */
export const CrossSpawnChildProcessSpawnerLayer = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make(
    Effect.fn('CrossSpawnChildProcessSpawner.spawn')(function* (command) {
      if (command._tag !== 'StandardCommand' || command.options.shell)
        return yield* PlatformError.badArgument({
          module: 'ChildProcess',
          method: 'spawn',
          description: 'shell and piped commands are not supported'
        });
      const process = yield* Effect.acquireRelease(acquireProcess(command), value =>
        terminate(value).pipe(Effect.ensuring(Effect.sync(value.removeListeners)))
      );
      const failure = yield* Effect.promise(() => process.ready);
      if (failure) return yield* failure;
      const stdout = fromReadable(process.handle.stdout);
      const stderr = fromReadable(process.handle.stderr);
      return ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(process.handle.pid ?? 0),
        exitCode: Effect.promise(() => process.closed).pipe(
          Effect.flatMap(({ code }) =>
            isNotNull(code)
              ? Effect.succeed(ChildProcessSpawner.ExitCode(code))
              : Effect.fail(systemError(undefined, 'exitCode'))
          )
        ),
        isRunning: Effect.sync(() => !process.isClosed()),
        kill: options => terminate(process, options),
        stdin: Sink.drain,
        stdout,
        stderr,
        all: Stream.merge(stdout, stderr),
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        unref: Effect.sync(() => {
          process.handle.unref();
          return Effect.sync(() => process.handle.ref()).pipe(Effect.asVoid);
        })
      });
    })
  )
);
