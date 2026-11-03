/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigService, TerminalService } from '@salesforce/vscode-services/v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ChildProcess from 'effect/process/ChildProcess';
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner';
import * as Stream from 'effect/Stream';
import * as TestClock from 'effect/testing/TestClock';
import { CrossSpawnChildProcessSpawnerLayer } from '../../../src/services/crossSpawnChildProcessSpawner.js';
import { SettingsServiceLayer } from '../../../src/services/settingsService.js';
import { TerminalServiceLayer } from '../../../src/services/terminalService.js';

const terminal = TerminalServiceLayer.pipe(
  Layer.provide(Layer.mergeAll(CrossSpawnChildProcessSpawnerLayer, SettingsServiceLayer, Layer.mock(ConfigService, {})))
);
const execute = (script: string, args: readonly string[] = []) =>
  TerminalService.use(service =>
    service.simpleExec({
      executable: process.execPath,
      args: ['-e', script, '--', ...args],
      parse: value => value
    })
  ).pipe(Effect.provide(terminal));

it('executes a real argv vector with spaces/metacharacters intact, inherited env and cwd', async () => {
  const args = ['space value', '; echo injected', '"quoted"', '$HOME'];
  const result = await Effect.runPromise(
    TerminalService.use(service =>
      service.simpleExec({
        executable: process.execPath,
        args: [
          '-e',
          'process.stdout.write(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd(),overlay:process.env.TERMINAL_NATIVE_TEST,path:process.env.PATH}))',
          '--',
          ...args
        ],
        env: { TERMINAL_NATIVE_TEST: 'overlay' },
        cwd: process.cwd(),
        parse: value => JSON.parse(value) as unknown
      })
    ).pipe(Effect.provide(terminal))
  );
  expect(result).toEqual({ args, cwd: process.cwd(), overlay: 'overlay', path: process.env.PATH });
});

it('drains a real process stdout and stderr concurrently beyond exec maxBuffer', async () => {
  const result = await Effect.runPromise(
    execute('process.stdout.write("x".repeat(2*1024*1024));process.stderr.write("y".repeat(2*1024*1024))')
  );
  expect(result).toHaveLength(2 * 1024 * 1024);
});

it('keeps real nonzero-exit stdout JSON and stderr', async () => {
  expect(
    await Effect.runPromise(
      execute('console.log("{\\"error\\":\\"failed\\"}");console.error("warning");process.exitCode=7').pipe(Effect.flip)
    )
  ).toMatchObject({
    errorType: 'nonzero_exit',
    exitCode: 7,
    message: 'Command failed (7)\nwarning\n{"error":"failed"}'
  });
});

it('reports a missing native executable as a spawn error', async () => {
  const missingExecutable = join(tmpdir(), 'missing-v4-fixture-executable.exe');
  expect(
    await Effect.runPromise(
      TerminalService.use(service =>
        service.simpleExec({ executable: missingExecutable, args: [], parse: value => value })
      ).pipe(Effect.provide(terminal), Effect.flip)
    )
  ).toMatchObject({ errorType: 'spawn_error', message: 'Command failed (NotFound)' });
});

it('kills and joins a real sleeping process when interrupted while an output pull is pending', async () => {
  const ready = Promise.withResolvers<number>();
  const controller = new AbortController();
  const running = Effect.runPromiseExit(
    Effect.gen(function* () {
      const child = yield* ChildProcessSpawner.use(service =>
        service.spawn(ChildProcess.make(process.execPath, ['-e', 'console.log("ready");setInterval(()=>{},1000)']))
      );
      yield* child.stdout.pipe(
        Stream.decodeText(),
        Stream.tap(() => Effect.sync(() => ready.resolve(child.pid))),
        Stream.runDrain
      );
    }).pipe(Effect.scoped, Effect.provide(CrossSpawnChildProcessSpawnerLayer)),
    { signal: controller.signal }
  );
  const pid = await ready.promise;
  controller.abort();
  expect(Exit.isFailure(await running)).toBe(true);
  expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
});

it('times out a real sleeping process without leaving an active child', async () => {
  const started = Promise.withResolvers<number>();
  const capturing = Layer.effect(
    ChildProcessSpawner,
    ChildProcessSpawner.pipe(
      Effect.map(spawner => ({
        ...spawner,
        spawn: (command: ChildProcess.Command) =>
          spawner.spawn(command).pipe(Effect.tap(child => Effect.sync(() => started.resolve(child.pid))))
      }))
    )
  ).pipe(Layer.provide(CrossSpawnChildProcessSpawnerLayer));
  const runtime = ManagedRuntime.make(
    TerminalServiceLayer.pipe(
      Layer.provide(Layer.mergeAll(capturing, SettingsServiceLayer, Layer.mock(ConfigService, {}))),
      Layer.provideMerge(TestClock.layer())
    )
  );
  try {
    const running = runtime.runPromise(
      TerminalService.use(service =>
        service.simpleExec({
          executable: process.execPath,
          args: ['-e', 'setInterval(()=>{},1000)'],
          parse: value => value,
          timeout: Duration.seconds(1)
        })
      ).pipe(Effect.flip)
    );
    const pid = await started.promise;
    await runtime.runPromise(TestClock.adjust(Duration.seconds(1)));
    expect(await running).toMatchObject({ errorType: 'timeout' });
    expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  } finally {
    await runtime.dispose();
  }
});
