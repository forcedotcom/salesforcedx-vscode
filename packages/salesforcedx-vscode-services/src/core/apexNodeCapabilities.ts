/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexConnectionError, ApexConnectionProvider, causeMessage } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ConnectionService } from './connectionService';

const connectionError = (cause: unknown): ApexConnectionError =>
  new ApexConnectionError({
    message: 'Unable to resolve a Salesforce connection for the Apex operation',
    cause: causeMessage(cause)
  });

/** Adapts the services extension's dynamic connection service to apex-node's host-neutral capability. */
export const ApexNodeConnectionProviderLayer = Layer.effect(
  ApexConnectionProvider,
  Effect.map(ConnectionService, connectionService => ({
    getConnection: connectionService.getConnection().pipe(Effect.mapError(connectionError)),
    getConnectionForOrg: orgId => connectionService.getConnectionForOrg(orgId).pipe(Effect.mapError(connectionError))
  }))
);
