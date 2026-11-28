/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ErrorHandlerService,
  ExtensionContextServiceLayer,
  UserCancellationError
} from '@salesforce/vscode-services/v2';
import type * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as vscode from 'vscode';
import { registerCommandWithRuntime } from '../../../src/services/registerCommand.js';

const callbacks = new Map<string, Parameters<typeof vscode.commands.registerCommand>[1]>();
const disposed: string[] = [];
const makeRuntime = () => {
  // Plain native-host data only; no Effect values are asserted or substituted.
  const context = {
    extension: { packageJSON: { displayName: 'Caller extension' } },
    subscriptions: []
  } as unknown as vscode.ExtensionContext;
  const handled: Cause.Cause<unknown>[] = [];
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      ExtensionContextServiceLayer(context),
      Layer.mock(ErrorHandlerService, {
        handleCause: cause =>
          Effect.sync(() => {
            handled.push(cause);
          })
      })
    )
  );
  return { runtime, handled, context, register: registerCommandWithRuntime(runtime) };
};
const invoke = (id: string, ...args: readonly unknown[]) => {
  const callback = callbacks.get(id);
  if (!callback) throw new Error(`Command not registered: ${id}`);
  const result: unknown = callback(...args);
  if (!Fiber.isFiber(result)) throw new Error('Command handler did not return its managed fiber');
  return result;
};

beforeEach(() => {
  callbacks.clear();
  disposed.length = 0;
  vi.mocked(vscode.commands.registerCommand).mockImplementation((id, callback) => {
    callbacks.set(id, callback);
    return {
      dispose: () => {
        callbacks.delete(id);
        disposed.push(id);
      }
    };
  });
});

it('keeps argument tuples and command tracing on the supplied runtime', async () => {
  const caller = makeRuntime();
  try {
    await caller.runtime.runPromise(
      caller.register('fixture.command', (name: string, count: number) =>
        Effect.currentSpan.pipe(
          Effect.map(span => ({
            name,
            count,
            span: span.name,
            command: span.attributes.get('command'),
            argCount: span.attributes.get('argCount')
          }))
        )
      )
    );
    expect(await Effect.runPromise(Fiber.join(invoke('fixture.command', 'value', 2)))).toEqual({
      name: 'value',
      count: 2,
      span: 'fixture.command',
      command: 'fixture.command',
      argCount: 2
    });
  } finally {
    await caller.runtime.dispose();
  }
});

it('swallows user cancellation but passes typed errors and synchronous defects to the same error handler', async () => {
  const caller = makeRuntime();
  const rejected = { _tag: 'CallerFailure', message: 'Rejected' } as const;
  const defect = new Error('Thrown command defect');
  try {
    await caller.runtime.runPromise(
      caller.register('fixture.cancel', () => Effect.fail(new UserCancellationError({ message: 'Cancelled' })))
    );
    await caller.runtime.runPromise(caller.register('fixture.fail', () => Effect.fail(rejected)));
    await caller.runtime.runPromise(
      caller.register('fixture.throw', () => {
        throw defect;
      })
    );
    await Effect.runPromise(Fiber.join(invoke('fixture.cancel')));
    expect(caller.handled).toHaveLength(0);
    await Effect.runPromise(Fiber.join(invoke('fixture.fail')));
    await Effect.runPromise(Fiber.join(invoke('fixture.throw')));
    expect(caller.handled).toHaveLength(2);
    expect(caller.handled[0]?.reasons).toContainEqual(expect.objectContaining({ _tag: 'Fail', error: rejected }));
    expect(caller.handled[1]?.reasons).toContainEqual(expect.objectContaining({ _tag: 'Die', defect }));
  } finally {
    await caller.runtime.dispose();
  }
});

it('unregisters scoped commands exactly once without handing cleanup to VS Code subscriptions', async () => {
  const caller = makeRuntime();
  await caller.runtime.runPromise(caller.register('fixture.scope', () => Effect.void));
  expect(callbacks.has('fixture.scope')).toBe(true);
  expect(caller.context.subscriptions).toHaveLength(0);
  await caller.runtime.dispose();
  await caller.runtime.dispose();
  expect(callbacks.has('fixture.scope')).toBe(false);
  expect(disposed).toEqual(['fixture.scope']);
});

it('awaits in-flight command finalizers before releasing command registrations', async () => {
  const caller = makeRuntime();
  const started = Promise.withResolvers<void>();
  const finalizing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let closed = false;
  try {
    await caller.runtime.runPromise(
      caller.register('fixture.running', () =>
        Effect.sync(() => started.resolve()).pipe(
          Effect.andThen(Effect.never),
          Effect.ensuring(
            Effect.promise(() => {
              finalizing.resolve();
              return release.promise;
            })
          )
        )
      )
    );
    const fiber = invoke('fixture.running');
    await started.promise;
    const closing = caller.runtime.dispose().then(() => {
      closed = true;
    });
    await finalizing.promise;
    expect(closed).toBe(false);
    expect(disposed).toEqual([]);
    release.resolve();
    await closing;
    expect(Exit.isFailure(await Effect.runPromise(Fiber.await(fiber)))).toBe(true);
    expect(disposed).toEqual(['fixture.running']);
  } finally {
    release.resolve();
    await caller.runtime.dispose();
  }
});
