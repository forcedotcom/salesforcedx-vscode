/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import { BadArgument, SystemError, type PlatformError } from '@effect/platform/Error';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import type { HashMap } from 'effect/HashMap';
import * as Inspectable from 'effect/Inspectable';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isError } from 'effect/Predicate';
import * as Sink from 'effect/Sink';
import * as Stream from 'effect/Stream';
import { type ChildProcess as NodeChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';

/** Spread `process.env` under Command.env so PATH survives when the overlay is set. */
export const resolveCommandEnv = (commandEnv: HashMap<string, string>): NodeJS.ProcessEnv => ({
  ...process.env,
  ...Object.fromEntries(commandEnv)
});

const toSystemError = (err: NodeJS.ErrnoException, executable: string): SystemError =>
  new SystemError({
    reason: err.code === 'ENOENT' ? 'NotFound' : 'Unknown',
    module: 'Command',
    method: 'spawn',
    pathOrDescriptor: executable,
    syscall: err.syscall,
    description: err.code
  });

const fromReadable = (readable: Readable | null): Stream.Stream<Uint8Array, PlatformError> =>
  readable === null
    ? Stream.empty
    : Stream.async<Uint8Array, PlatformError>(emit => {
        readable.on('data', (chunk: Buffer) => {
          void emit.single(new Uint8Array(chunk));
        });
        readable.on('end', () => {
          void emit.end();
        });
        readable.on('error', (err: Error) => {
          void emit.fail(
            new SystemError({
              reason: 'Unknown',
              module: 'Command',
              method: 'fromReadable',
              description: err.message
            })
          );
        });
      });

const ProcessProto = {
  [CommandExecutor.ProcessTypeId]: CommandExecutor.ProcessTypeId,
  ...Inspectable.BaseProto,
  toJSON(this: CommandExecutor.Process) {
    return { pid: this.pid };
  }
};

const makeProcess = (
  handle: NodeChildProcess,
  exit: Deferred.Deferred<readonly [number | null, NodeJS.Signals | null]>
): CommandExecutor.Process => {
  const exitCode = Effect.flatMap(Deferred.await(exit), ([code, signal]) =>
    code !== null
      ? Effect.succeed(CommandExecutor.ExitCode(code))
      : Effect.fail(
          new SystemError({
            reason: 'Unknown',
            module: 'Command',
            method: 'exitCode',
            description: signal ?? undefined
          })
        )
  );
  return Object.assign(Object.create(ProcessProto), {
    pid: CommandExecutor.ProcessId(handle.pid ?? 0),
    exitCode,
    isRunning: Effect.map(Deferred.isDone(exit), done => !done),
    kill: () =>
      Effect.sync(() => {
        handle.kill('SIGTERM');
      }),
    stdin: Sink.drain,
    stdout: fromReadable(handle.stdout),
    stderr: fromReadable(handle.stderr)
  });
};

const startStandard = (command: Command.StandardCommand) =>
  command.shell !== false
    ? Effect.fail(
        new BadArgument({
          module: 'Command',
          method: 'start',
          description: 'shell is not supported'
        })
      )
    : Effect.flatMap(Deferred.make<readonly [number | null, NodeJS.Signals | null]>(), exit =>
        Effect.flatMap(
          Effect.tryPromise({
            try: () => import('cross-spawn'),
            catch: (err: unknown) =>
              new SystemError({
                reason: 'Unknown',
                module: 'Command',
                method: 'spawn',
                pathOrDescriptor: command.command,
                description: isError(err) ? err.message : undefined
              })
          }),
          ({ default: spawn }) =>
            Effect.async<CommandExecutor.Process, PlatformError>(resume => {
              const handle = spawn(command.command, [...command.args], {
                stdio: ['ignore', 'pipe', 'pipe'],
                cwd: Option.getOrUndefined(command.cwd),
                env: resolveCommandEnv(command.env),
                shell: false
              });
              handle.on('error', (err: NodeJS.ErrnoException) => {
                resume(Effect.fail(toSystemError(err, command.command)));
              });
              handle.on('exit', (code, signal) => {
                Deferred.unsafeDone(exit, Effect.succeed([code, signal]));
              });
              handle.on('spawn', () => {
                resume(Effect.succeed(makeProcess(handle, exit)));
              });
              return Effect.sync(() => {
                handle.kill('SIGTERM');
              });
            })
        )
      );

/** argv spawn via cross-spawn (Windows `.cmd` shims). `shell` is never enabled. */
export const CrossSpawnCommandExecutorLive = Layer.succeed(
  CommandExecutor.CommandExecutor,
  CommandExecutor.makeExecutor(command => {
    const [standard, ...rest] = Command.flatten(command);
    return standard === undefined || rest.length > 0
      ? Effect.fail(
          new BadArgument({
            module: 'Command',
            method: 'start',
            description: 'piped commands are not supported'
          })
        )
      : Effect.acquireRelease(startStandard(standard), proc => Effect.ignore(proc.kill()));
  })
);
