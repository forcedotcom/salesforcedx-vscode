/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexConnectionError, ApexConnectionProvider } from '@salesforce/apex-node/effect';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ApexNodeConnectionProviderLayer } from '../../../src/core/apexNodeCapabilities';
import { ConnectionService, NoTargetOrgConfiguredError } from '../../../src/core/connectionService';

const connection = { getAuthInfoFields: () => ({ orgId: '00D-current' }) } as unknown as Connection;

const runWithConnectionService = <A, E>(
  operation: Effect.Effect<A, E, ApexConnectionProvider>,
  getConnection: InstanceType<typeof ConnectionService>['getConnection']
): Promise<A> => {
  const connectionServiceLayer = Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection,
      getConnectionForOrg: () => getConnection()
    } as unknown as InstanceType<typeof ConnectionService>)
  );
  const layer = ApexNodeConnectionProviderLayer.pipe(Layer.provide(connectionServiceLayer));
  return Effect.runPromise(operation.pipe(Effect.provide(layer)));
};

describe('ApexNodeConnectionProviderLayer', () => {
  it('delegates connection lookup to the services ConnectionService', async () => {
    const operation = ApexConnectionProvider.pipe(Effect.flatMap(provider => provider.getConnection));

    await expect(runWithConnectionService(operation, () => Effect.succeed(connection))).resolves.toBe(connection);
  });

  it('maps host-specific connection failures to the apex-node capability error', async () => {
    const operation = ApexConnectionProvider.pipe(
      Effect.flatMap(provider => provider.getConnection),
      Effect.flip
    );
    const hostError = new NoTargetOrgConfiguredError({ message: 'No target org configured' });

    await expect(runWithConnectionService(operation, () => Effect.fail(hostError))).resolves.toMatchObject({
      _tag: 'ApexConnectionError',
      cause: 'No target org configured'
    } satisfies Partial<ApexConnectionError>);
  });
});
