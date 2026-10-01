/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexConnectionError } from '../errors';
import type { Connection } from '@salesforce/core';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

/** Host capability used by Apex operations to obtain their current Salesforce connection. */
export type ApexConnectionProvider = {
  readonly getConnection: Effect.Effect<Connection, ApexConnectionError>;
};

/** Host-neutral connection capability for the primary Effect API. */
export const ApexConnectionProvider = Context.GenericTag<ApexConnectionProvider>(
  '@salesforce/apex-node/ApexConnectionProvider'
);

/** Creates a connection provider backed by a fixed connection, as used by CLI and class-facade consumers. */
export const makeApexConnectionProvider = (connection: Connection): ApexConnectionProvider => ({
  getConnection: Effect.succeed(connection)
});

/** Provides a fixed Salesforce connection to Apex Effect operations. */
export const apexConnectionLayer = (connection: Connection): Layer.Layer<ApexConnectionProvider> =>
  Layer.succeed(ApexConnectionProvider, makeApexConnectionProvider(connection));
