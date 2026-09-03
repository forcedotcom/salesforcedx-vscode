/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as vscode from 'vscode';
import { ErrorHandlerService } from '../../src/vscode/errorHandlerService';
import { ExtensionContextServiceLayer } from '../../src/vscode/extensionContextService';
import { registerCommandWithRuntime } from '../../src/vscode/registerCommand';

describe('registerCommandWithRuntime', () => {
  const extensionContext = {
    extension: { packageJSON: { displayName: 'Test Extension' } },
    subscriptions: []
  } as unknown as vscode.ExtensionContext;
  const services = Layer.merge(
    ExtensionContextServiceLayer(extensionContext),
    Layer.succeed(
      ErrorHandlerService,
      new ErrorHandlerService({
        handleCause: () => Effect.void
      })
    )
  );

  it('runs the command in a tracked fiber by default', async () => {
    const runtime = ManagedRuntime.make(Layer.empty);

    await Effect.runPromise(
      registerCommandWithRuntime(runtime)('sf.test.default', () => Effect.succeed('/logs/selected.log')).pipe(
        Effect.provide(services)
      )
    );
    const commandHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1] as () => Fiber.RuntimeFiber<
      string | void,
      never
    >;

    await expect(Effect.runPromise(Fiber.join(commandHandler()))).resolves.toBe('/logs/selected.log');
    await runtime.dispose();
  });

  it('returns the command Effect result when requested', async () => {
    const runtime = ManagedRuntime.make(Layer.empty);

    await Effect.runPromise(
      registerCommandWithRuntime(runtime, { returnEffectResult: true })('sf.test.returnValue', () =>
        Effect.succeed('/logs/selected.log')
      ).pipe(Effect.provide(services))
    );
    const commandHandler = (vscode.commands.registerCommand as jest.Mock).mock.calls[0][1] as () => Promise<string>;

    await expect(commandHandler()).resolves.toBe('/logs/selected.log');
    await runtime.dispose();
  });
});
