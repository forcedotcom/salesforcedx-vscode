/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { promisify } from 'node:util';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import { TerminalService, TerminalServiceError } from '../../../src/terminal/terminalService';

// simpleExec dynamically imports child_process.exec and wraps it with util.promisify.
// Attach promisify.custom to the mocked exec so the real promisify returns our controllable async fn.
const promisified = jest.fn<Promise<{ stdout: string }>, [string, { signal?: AbortSignal; timeout?: number }]>();
const execMock = Object.assign(jest.fn(), { [promisify.custom]: promisified });

jest.mock('node:child_process', () => ({ exec: execMock }));

const run = <A, E>(effect: Effect.Effect<A, E, TerminalService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TerminalService.Default)));

describe('TerminalService.simpleExec', () => {
  beforeEach(() => {
    delete process.env.ESBUILD_PLATFORM;
    promisified.mockReset();
  });

  it('aborts the child signal when the fiber is interrupted', async () => {
    let capturedSignal: AbortSignal | undefined;
    // never resolves: the promise stays in flight until the runtime aborts the signal on interrupt
    promisified.mockImplementation((_cmd, opts) => {
      capturedSignal = opts.signal;
      return new Promise(() => {});
    });

    const fiber = Effect.runFork(
      Effect.gen(function* () {
        const terminal = yield* TerminalService;
        return yield* terminal.simpleExec({ command: 'sf org delete' });
      }).pipe(Effect.provide(TerminalService.Default))
    );

    // let the fiber reach the in-flight exec call
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(capturedSignal?.aborted).toBe(false);

    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('trims stdout and passes it to parse on the happy path', async () => {
    promisified.mockResolvedValue({ stdout: '  hello world  \n' });
    const parse = jest.fn((s: string) => s.toUpperCase());

    const result = await run(
      Effect.gen(function* () {
        const terminal = yield* TerminalService;
        return yield* terminal.simpleExec({ command: 'sf foo', parse });
      })
    );

    expect(parse).toHaveBeenCalledWith('hello world');
    expect(result).toBe('HELLO WORLD');
  });

  it('fails with TerminalServiceError on web', async () => {
    process.env.ESBUILD_PLATFORM = 'web';

    const error = await run(
      Effect.gen(function* () {
        const terminal = yield* TerminalService;
        return yield* terminal.simpleExec({ command: 'sf foo' });
      }).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(TerminalServiceError);
    expect(error.command).toBe('sf foo');
  });
});
