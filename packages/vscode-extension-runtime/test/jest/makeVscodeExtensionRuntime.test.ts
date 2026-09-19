/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Logger from 'effect/Logger';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { makeVscodeExtensionRuntime } from '../../src/makeVscodeExtensionRuntime';

const VERSION_MISMATCH_PREFIX = 'Executing an Effect versioned';

const withEffectVersion = <A, E, R>(effect: Effect.Effect<A, E, R>, version: string): Effect.Effect<A, E, R> =>
  new Proxy(effect, {
    get: (target, property, receiver): unknown =>
      property === Effect.EffectTypeId
        ? { ...target[Effect.EffectTypeId], _V: version }
        : Reflect.get(target, property, receiver)
  });

const captureLogs = (messages: string[]) =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ message }) => messages.push(String(message)))
  );

describe('makeVscodeExtensionRuntime', () => {
  const mismatchedEffect = withEffectVersion(Effect.succeed('completed'), '0.0.0');

  it('creates an Effect that triggers the version-mismatch warning in an unconfigured runtime', async () => {
    const messages: string[] = [];
    const runtime = ManagedRuntime.make(captureLogs(messages));

    await expect(runtime.runPromise(mismatchedEffect)).resolves.toBe('completed');
    expect(messages).toEqual(expect.arrayContaining([expect.stringContaining(VERSION_MISMATCH_PREFIX)]));

    await runtime.dispose();
  });

  it('suppresses only the version-mismatch warning', async () => {
    const messages: string[] = [];
    const runtime = makeVscodeExtensionRuntime(captureLogs(messages));

    await expect(
      runtime.runPromise(Effect.logWarning('application warning').pipe(Effect.zipRight(mismatchedEffect)))
    ).resolves.toBe('completed');
    expect(messages).toContain('application warning');
    expect(messages).not.toEqual(expect.arrayContaining([expect.stringContaining(VERSION_MISMATCH_PREFIX)]));

    await runtime.dispose();
  });
});
