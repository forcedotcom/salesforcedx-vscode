/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { UserCancellationError } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { expectTypeOf } from 'vitest';
import {
  withCancellableProgress,
  withCancellableProgressReporting,
  withProgress
} from '../../../src/services/promptProgress.js';

class CallerValue extends Context.Service<CallerValue, { readonly value: string }>()('test/PromptCallerValue') {}
class CallerFailure extends Schema.TaggedError<CallerFailure>()('CallerFailure', { message: Schema.String }) {}

const createHost = (onListenerDispose?: () => void) => {
  let cancelled = false;
  let closed = false;
  const listeners = new Set<() => void>();
  const listenerDisposed = vi.fn();
  const token: vscode.CancellationToken = {
    get isCancellationRequested() {
      return cancelled;
    },
    onCancellationRequested: listener => {
      const invoke = () => {
        listener(undefined);
      };
      listeners.add(invoke);
      return {
        dispose: () => {
          listeners.delete(invoke);
          listenerDisposed();
          onListenerDispose?.();
        }
      };
    }
  };
  const progress = { report: vi.fn() };
  vi.mocked(vscode.window.withProgress).mockImplementation(async (_options, task) => {
    const result = await task(progress, token);
    closed = true;
    return result;
  });
  return {
    token,
    progress,
    listenerDisposed,
    isClosed: () => closed,
    listenerCount: () => listeners.size,
    cancel: () => {
      cancelled = true;
      listeners.forEach(listener => listener());
    }
  };
};
const failureReasons = <A, E>(exit: Exit.Exit<A, E>) => {
  expect(Exit.isFailure(exit)).toBe(true);
  return Exit.isFailure(exit) ? exit.cause.reasons : [];
};

it('preserves caller values, typed errors, required services and tracing', async () => {
  const host = createHost();
  const failure = new CallerFailure({ message: 'Caller rejected' });
  const program = withCancellableProgressReporting(
    'Working',
    vscode.ProgressLocation.Window
  )((progress, token) =>
    Effect.gen(function* () {
      const caller = yield* CallerValue;
      const span = yield* Effect.currentSpan.pipe(Effect.orDie);
      progress.report({ increment: 50, message: caller.value });
      expect(token).toBe(host.token);
      if (caller.value === 'fail') return yield* failure;
      return { value: caller.value, span: span.name, literal: 'result' as const };
    })
  );
  expectTypeOf<Effect.Services<typeof program>>().toEqualTypeOf<CallerValue>();
  expectTypeOf<Effect.Error<typeof program>>().toEqualTypeOf<CallerFailure | UserCancellationError>();
  expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<{ value: string; span: string; literal: 'result' }>();
  expect(
    await Effect.runPromise(
      program.pipe(Effect.provideService(CallerValue, { value: 'caller' }), Effect.withSpan('caller.span'))
    )
  ).toEqual({
    value: 'caller',
    span: 'caller.span',
    literal: 'result'
  });
  expect(host.progress.report).toHaveBeenCalledWith({ increment: 50, message: 'caller' });
  expect(vscode.window.withProgress).toHaveBeenCalledWith(
    { title: 'Working', location: vscode.ProgressLocation.Window, cancellable: true },
    expect.any(Function)
  );
  expect(host.isClosed()).toBe(true);
  expect(host.listenerDisposed).toHaveBeenCalledTimes(1);
  expect(
    await Effect.runPromise(
      program.pipe(
        Effect.provideService(CallerValue, { value: 'fail' }),
        Effect.withSpan('caller.failure'),
        Effect.flip
      )
    )
  ).toBe(failure);
});

it('retains caller Scope requirements and uses the supplied scope rather than a new progress scope', async () => {
  createHost();
  const program = withCancellableProgress('Scoped')(Scope.Scope);
  expectTypeOf<Effect.Services<typeof program>>().toEqualTypeOf<Scope.Scope>();
  const scope = Effect.runSync(Scope.make());
  try {
    expect(await Effect.runPromise(program.pipe(Scope.provide(scope)))).toBe(scope);
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
});

it('keeps non-cancellable progress error types unchanged and closes it on typed failure', async () => {
  const host = createHost();
  const error = new CallerFailure({ message: 'Failed' });
  const program = withProgress('Working')(Effect.fail(error));
  expectTypeOf<Effect.Error<typeof program>>().toEqualTypeOf<CallerFailure>();
  expect(await Effect.runPromise(program.pipe(Effect.flip))).toBe(error);
  expect(host.listenerCount()).toBe(0);
  expect(host.isClosed()).toBe(true);
});

it('does not start the caller program when the native token is already cancelled', async () => {
  const host = createHost();
  host.cancel();
  const build = vi.fn(() => Effect.succeed('unexpected'));
  const exit = await Effect.runPromiseExit(withCancellableProgressReporting('Working')(build));
  expect(
    failureReasons(exit).some(reason => reason._tag === 'Fail' && reason.error instanceof UserCancellationError)
  ).toBe(true);
  expect(build).not.toHaveBeenCalled();
  expect(host.listenerDisposed).toHaveBeenCalledTimes(1);
  expect(host.isClosed()).toBe(true);
});

it('keeps progress open and the caller pending until cancelled work finishes its slow finalizer', async () => {
  const host = createHost();
  const started = Promise.withResolvers<void>();
  const finalizing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let settled = false;
  const program = Effect.sync(() => started.resolve()).pipe(
    Effect.andThen(Effect.never),
    Effect.onExit(() =>
      Effect.promise(() => {
        finalizing.resolve();
        return release.promise;
      })
    )
  );
  const running = Effect.runPromiseExit(withCancellableProgress('Working')(program)).then(result => {
    settled = true;
    return result;
  });
  try {
    await started.promise;
    host.cancel();
    host.cancel();
    await finalizing.promise;
    expect(settled).toBe(false);
    expect(host.isClosed()).toBe(false);
    expect(host.listenerDisposed).not.toHaveBeenCalled();
  } finally {
    release.resolve();
  }
  const exit = await running;
  expect(
    failureReasons(exit).some(reason => reason._tag === 'Fail' && reason.error instanceof UserCancellationError)
  ).toBe(true);
  expect(host.isClosed()).toBe(true);
  expect(host.listenerDisposed).toHaveBeenCalledTimes(1);
  expect(host.listenerCount()).toBe(0);
  expect(() => host.cancel()).not.toThrow();
});

it('retains typed cleanup failures alongside button cancellation instead of converting them to defects', async () => {
  const host = createHost();
  const started = Promise.withResolvers<void>();
  const cleanup = new CallerFailure({ message: 'Cleanup rejected' });
  const running = Effect.runPromiseExit(
    withCancellableProgress('Working')(
      Effect.sync(() => started.resolve()).pipe(
        Effect.andThen(Effect.never),
        Effect.onExit(() => Effect.fail(cleanup))
      )
    )
  );
  await started.promise;
  host.cancel();
  const reasons = failureReasons(await running);
  expect(reasons).toHaveLength(2);
  expect(reasons[0]?._tag).toBe('Fail');
  if (reasons[0]?._tag === 'Fail') expect(reasons[0].error).toBeInstanceOf(UserCancellationError);
  expect(reasons[1]).toMatchObject({ _tag: 'Fail', error: cleanup });
  if (reasons[1]?._tag === 'Fail') expect(reasons[1].error).toBe(cleanup);
  expect(host.isClosed()).toBe(true);
});

it('retains normal caller and cleanup failures once each', async () => {
  createHost();
  const first = new CallerFailure({ message: 'Body rejected' });
  const second = new CallerFailure({ message: 'Cleanup rejected' });
  const reasons = failureReasons(
    await Effect.runPromiseExit(
      withCancellableProgress('Working')(Effect.fail(first).pipe(Effect.onExit(() => Effect.fail(second))))
    )
  );
  expect(reasons).toHaveLength(2);
  expect(reasons[0]).toMatchObject({ _tag: 'Fail', error: first });
  expect(reasons[1]).toMatchObject({ _tag: 'Fail', error: second });
});

it('preserves real fiber interruption and waits for its finalizers before closing progress', async () => {
  const host = createHost();
  const controller = new AbortController();
  const started = Promise.withResolvers<void>();
  const finalizing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let settled = false;
  const running = Effect.runPromiseExit(
    withCancellableProgress('Working')(
      Effect.sync(() => started.resolve()).pipe(
        Effect.andThen(Effect.never),
        Effect.onExit(() =>
          Effect.promise(() => {
            finalizing.resolve();
            return release.promise;
          })
        )
      )
    ),
    { signal: controller.signal }
  ).then(result => {
    settled = true;
    return result;
  });
  try {
    await started.promise;
    controller.abort();
    await finalizing.promise;
    expect(settled).toBe(false);
    expect(host.isClosed()).toBe(false);
  } finally {
    release.resolve();
  }
  const exit = await running;
  expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
  expect(
    failureReasons(exit).some(reason => reason._tag === 'Fail' && reason.error instanceof UserCancellationError)
  ).toBe(false);
  expect(host.listenerDisposed).toHaveBeenCalledTimes(1);
  expect(host.isClosed()).toBe(true);
});

it('surfaces a failing finalizer as a defect without dropping cancellation', async () => {
  const host = createHost();
  const started = Promise.withResolvers<void>();
  const defect = new Error('Cleanup defect');
  const running = Effect.runPromiseExit(
    withCancellableProgress('Working')(
      Effect.sync(() => started.resolve()).pipe(Effect.andThen(Effect.never), Effect.ensuring(Effect.die(defect)))
    )
  );
  await started.promise;
  host.cancel();
  const reasons = failureReasons(await running);
  expect(reasons).toHaveLength(2);
  expect(reasons[0]?._tag).toBe('Fail');
  if (reasons[0]?._tag === 'Fail') expect(reasons[0].error).toBeInstanceOf(UserCancellationError);
  expect(reasons[1]).toMatchObject({ _tag: 'Die', defect });
});

it('closes progress after a synchronous caller defect', async () => {
  const host = createHost();
  const defect = new Error('Build threw');
  const reasons = failureReasons(
    await Effect.runPromiseExit(
      withCancellableProgressReporting('Working')(() => {
        throw defect;
      })
    )
  );
  expect(reasons).toHaveLength(1);
  expect(reasons[0]).toMatchObject({ _tag: 'Die', defect });
  expect(host.isClosed()).toBe(true);
  expect(host.listenerDisposed).toHaveBeenCalledTimes(1);
});

it('propagates native synchronous and asynchronous startup failures without running the build', async () => {
  const defect = new Error('Native progress failed');
  const build = vi.fn(() => Effect.succeed('unexpected'));
  for (const start of [
    () => {
      throw defect;
    },
    () => Promise.reject(defect)
  ]) {
    vi.mocked(vscode.window.withProgress).mockImplementation(start);
    const reasons = failureReasons(await Effect.runPromiseExit(withCancellableProgressReporting('Working')(build)));
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatchObject({ _tag: 'Die', defect });
  }
  expect(build).not.toHaveBeenCalled();
});

it('retains a native closing failure together with a caller failure', async () => {
  const host = createHost();
  const native = new Error('Native close failed');
  const caller = new CallerFailure({ message: 'Caller rejected' });
  vi.mocked(vscode.window.withProgress).mockImplementation(async (_options, task) => {
    await task(host.progress, host.token);
    throw native;
  });
  const reasons = failureReasons(await Effect.runPromiseExit(withCancellableProgress('Working')(Effect.fail(caller))));
  expect(reasons).toHaveLength(2);
  expect(reasons[0]).toMatchObject({ _tag: 'Die', defect: caller });
  expect(reasons[1]).toMatchObject({ _tag: 'Die', defect: native });
  expect(host.listenerDisposed).toHaveBeenCalledTimes(1);
});

it('does not run a delayed native task after its caller has been interrupted', async () => {
  const host = createHost();
  const opened = Promise.withResolvers<void>();
  const startTask = Promise.withResolvers<void>();
  const controller = new AbortController();
  const build = vi.fn(() => Effect.succeed('unexpected'));
  vi.mocked(vscode.window.withProgress).mockImplementation(async (_options, task) => {
    opened.resolve();
    await startTask.promise;
    return task(host.progress, host.token);
  });
  const operation = Effect.runPromiseExit(withCancellableProgressReporting('Working')(build), {
    signal: controller.signal
  });
  await opened.promise;
  controller.abort();
  startTask.resolve();
  const exit = await operation;
  expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
  expect(build).not.toHaveBeenCalled();
  expect(host.listenerCount()).toBe(0);
});

it('interrupts started work and awaits cleanup when the native progress host later rejects', async () => {
  const host = createHost();
  const started = Promise.withResolvers<void>();
  const native = Promise.withResolvers<never>();
  const defect = new Error('Native host rejected after starting');
  const finalized = vi.fn();
  vi.mocked(vscode.window.withProgress).mockImplementation((_options, task) => {
    task(host.progress, host.token);
    return native.promise;
  });
  const running = Effect.runPromiseExit(
    withCancellableProgress('Working')(
      Effect.sync(() => started.resolve()).pipe(Effect.andThen(Effect.never), Effect.ensuring(Effect.sync(finalized)))
    )
  );
  await started.promise;
  native.reject(defect);
  const reasons = failureReasons(await running);
  expect(reasons).toHaveLength(1);
  expect(reasons[0]).toMatchObject({ _tag: 'Die', defect });
  expect(finalized).toHaveBeenCalledTimes(1);
  expect(host.listenerDisposed).toHaveBeenCalledTimes(1);
});

it('closes the native task even when cancellation-listener disposal throws', async () => {
  const defect = new Error('Listener disposal failed');
  const host = createHost(() => {
    throw defect;
  });
  const reasons = failureReasons(
    await Effect.runPromiseExit(withCancellableProgress('Working')(Effect.succeed('value')))
  );
  expect(reasons).toHaveLength(1);
  expect(reasons[0]).toMatchObject({ _tag: 'Die', defect });
  expect(host.listenerCount()).toBe(0);
  expect(host.isClosed()).toBe(true);
});

it('waits for the native host completion after the caller program has finished', async () => {
  const host = createHost();
  const taskClosed = Promise.withResolvers<void>();
  const acknowledge = Promise.withResolvers<void>();
  let settled = false;
  vi.mocked(vscode.window.withProgress).mockImplementation(async (_options, task) => {
    const result = await task(host.progress, host.token);
    taskClosed.resolve();
    await acknowledge.promise;
    return result;
  });
  const running = Effect.runPromise(withProgress('Working')(Effect.succeed('value'))).then(value => {
    settled = true;
    return value;
  });
  try {
    await taskClosed.promise;
    expect(settled).toBe(false);
  } finally {
    acknowledge.resolve();
  }
  expect(await running).toBe('value');
});
