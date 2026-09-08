/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { ApexConnectionError, ApexConnectionProvider, makeApexConnectionProvider } from '../../src/effect';
import { ApexClassRunner } from '../../src/effect/internal/classRunner';

const connectionFor = (orgId: string): Connection =>
  ({ getAuthInfoFields: () => ({ orgId }) }) as unknown as Connection;

describe('apex-node Effect foundation', () => {
  it('provides a fixed connection to Effect operations', async () => {
    const connection = connectionFor('00D-current');
    const provider = makeApexConnectionProvider(connection);

    await expect(Effect.runPromise(provider.getConnection)).resolves.toBe(connection);
    await expect(Effect.runPromise(provider.getConnectionForOrg('00D-current'))).resolves.toBe(connection);
  });

  it('fails with a tagged error when a fixed connection belongs to another org', async () => {
    const exit = await makeApexConnectionProvider(connectionFor('00D-other'))
      .getConnectionForOrg('00D-expected')
      .pipe(Effect.flip, Effect.runPromise);

    expect(exit).toBeInstanceOf(ApexConnectionError);
    expect(exit).toMatchObject({
      _tag: 'ApexConnectionError',
      message: "Expected connection for org '00D-expected', but received '00D-other'"
    });
  });

  it('runs an Effect operation behind the traditional class boundary', async () => {
    const connection = connectionFor('00D-current');
    const runner = new ApexClassRunner(connection);
    const operation = ApexConnectionProvider.pipe(Effect.flatMap(provider => provider.getConnection));

    await expect(runner.runPromise(operation)).resolves.toBe(connection);
  });
});
