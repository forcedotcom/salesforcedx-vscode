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

const warningPrefix = 'Executing an Effect versioned';
const mismatchedEffect = new Proxy(Effect.succeed('completed'), {
  get: (target, property, receiver) => {
    if (property === Effect.EffectTypeId) {
      return { ...target[Effect.EffectTypeId], _V: '0.0.0' };
    }
    return Reflect.get(target, property, receiver);
  }
});

describe('suppressVersionMismatchWarning', () => {
  it('logs the version mismatch without suppression', async () => {
    const messages: string[] = [];
    const captureLogs = Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ message }) => {
        messages.push(String(message));
      })
    );
    const runtime = ManagedRuntime.make(captureLogs);

    try {
      await expect(runtime.runPromise(mismatchedEffect)).resolves.toBe('completed');
      expect(messages.some(message => message.includes(warningPrefix))).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });

  it('suppresses only the version mismatch warning', async () => {
    const messages: string[] = [];
    const captureLogs = Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ message }) => {
        messages.push(String(message));
      })
    );
    const runtime = ManagedRuntime.make(Layer.merge(captureLogs, suppressVersionMismatchWarning));

    try {
      await expect(
        runtime.runPromise(Effect.zipRight(Effect.logWarning('application warning'), mismatchedEffect))
      ).resolves.toBe('completed');
      expect(messages).toContain('application warning');
      expect(messages.some(message => message.includes(warningPrefix))).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });
});
