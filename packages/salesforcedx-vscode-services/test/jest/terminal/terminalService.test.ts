/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import { ChildProcess, ExecOptions, ExecResult } from '../../../src/terminal/childProcess';
import { TerminalService, TerminalServiceError } from '../../../src/terminal/terminalService';

// Swap the ChildProcess seam via the Effect layer instead of mocking node:child_process. This keeps
// ts-jest on isolatedModules:true for the whole package (no commonjs downlevel needed for this suite).
const withExec = (exec: (command: string, options: ExecOptions) => Promise<ExecResult>) =>
  TerminalService.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.succeed(ChildProcess, ChildProcess.make({ exec })))
  );

const run = <A, E>(effect: Effect.Effect<A, E, TerminalService>, layer: Layer.Layer<TerminalService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer)));

describe('TerminalService.simpleExec', () => {
  beforeEach(() => {
    delete process.env.ESBUILD_PLATFORM;
  });

  it('aborts the child signal when the fiber is interrupted', async () => {
    let capturedSignal: AbortSignal | undefined;
    // never resolves: the promise stays in flight until the runtime aborts the signal on interrupt
    const exec = (_command: string, options: ExecOptions): Promise<ExecResult> => {
      capturedSignal = options.signal;
      return new Promise<ExecResult>(() => {});
    };

    const fiber = Effect.runFork(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org delete', parse: s => s })),
        Effect.provide(withExec(exec))
      )
    );

    // poll until the fiber reaches the in-flight exec call (avoids a fixed-sleep race under CI load)
    while (capturedSignal === undefined) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    expect(capturedSignal.aborted).toBe(false);

    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(capturedSignal.aborted).toBe(true);
  });

  it('trims stdout and passes it to parse on the happy path', async () => {
    const exec = (): Promise<ExecResult> => Promise.resolve({ stdout: '  hello world  \n', stderr: '' });
    const parse = jest.fn((s: string) => s.toUpperCase());

    const result = await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse }))),
      withExec(exec)
    );

    expect(parse).toHaveBeenCalledWith('hello world');
    expect(result).toBe('HELLO WORLD');
  });

  it('passes the timeout through to exec', async () => {
    let capturedOptions: ExecOptions | undefined;
    const exec = (_command: string, options: ExecOptions): Promise<ExecResult> => {
      capturedOptions = options;
      return Promise.resolve({ stdout: '', stderr: '' });
    };

    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse: s => s }))),
      withExec(exec)
    );

    expect(capturedOptions?.timeout).toBe(30_000);
  });

  it('forwards env to the injected ChildProcess.exec', async () => {
    let capturedOptions: ExecOptions | undefined;
    const exec = (_command: string, options: ExecOptions): Promise<ExecResult> => {
      capturedOptions = options;
      return Promise.resolve({ stdout: '', stderr: '' });
    };

    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ command: 'sf org open', parse: s => s, env: { SF_JSON_TO_STDOUT: 'true' } })
        )
      ),
      withExec(exec)
    );

    expect(capturedOptions?.env).toEqual({ SF_JSON_TO_STDOUT: 'true' });
  });

  it('fails with TerminalServiceError on web', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    const exec = (): Promise<ExecResult> => Promise.reject(new Error('should not be called on web'));

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse: s => s })),
        Effect.flip
      ),
      withExec(exec)
    );

    expect(error).toBeInstanceOf(TerminalServiceError);
    expect(error.command).toBe('sf foo');
  });
});
