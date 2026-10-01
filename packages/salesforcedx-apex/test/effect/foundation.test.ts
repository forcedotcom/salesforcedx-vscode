/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { ApexConnectionProvider, makeApexConnectionProvider } from '../../src/effect';
import { ApexClassRunner } from '../../src/effect/internal/classRunner';

const connection = {} as Connection;

describe('apex-node Effect foundation', () => {
  it('provides a fixed connection to Effect operations', async () => {
    const provider = makeApexConnectionProvider(connection);

    await expect(Effect.runPromise(provider.getConnection)).resolves.toBe(connection);
  });

  it('runs an Effect operation behind the traditional class boundary', async () => {
    const runner = new ApexClassRunner(connection);
    const operation = ApexConnectionProvider.pipe(Effect.flatMap(provider => provider.getConnection));

    await expect(runner.runPromise(operation)).resolves.toBe(connection);
  });
});
