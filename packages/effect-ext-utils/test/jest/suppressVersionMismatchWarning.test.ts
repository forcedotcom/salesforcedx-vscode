/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { suppressVersionMismatchWarning } from '../../src/allServicesLayer';

const mismatchPrefix = 'Executing an Effect versioned';
const mismatchedEffect = new Proxy(Effect.succeed('completed'), {
  get: (target, property, receiver) => {
    if (property === Effect.EffectTypeId) {
      return { ...Reflect.get(target, property, receiver), _V: '0.0.0' };
    }
    return Reflect.get(target, property, receiver);
  }
});

describe('suppressVersionMismatchWarning', () => {
  it('logs a version mismatch with the default runtime', async () => {
    const messages: string[] = [];
    const captureLogs = Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ message }) => {
        messages.push(String(message));
      })
    );
    const runtime = ManagedRuntime.make(captureLogs);

    expect(await runtime.runPromise(mismatchedEffect)).toBe('completed');
    expect(messages.some(message => message.includes(mismatchPrefix))).toBe(true);

    await runtime.dispose();
  });

  it('mutes the version mismatch without muting application warnings', async () => {
    const messages: string[] = [];
    const captureLogs = Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ message }) => {
        messages.push(String(message));
      })
    );
    const runtime = ManagedRuntime.make(Layer.merge(captureLogs, suppressVersionMismatchWarning));

    expect(
      await runtime.runPromise(Effect.logWarning('application warning').pipe(Effect.zipRight(mismatchedEffect)))
    ).toBe('completed');
    expect(messages).toContain('application warning');
    expect(messages.some(message => message.includes(mismatchPrefix))).toBe(false);

    await runtime.dispose();
  });
});
