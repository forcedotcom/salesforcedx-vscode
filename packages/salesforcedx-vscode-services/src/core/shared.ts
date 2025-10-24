/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, Connection, ConfigAggregator } from '@salesforce/core';

import * as Effect from 'effect/Effect';

/** passing in a configAggregator is highly recommended to avoid sfdx-core creating a new one  */
export const getOrgFromConnection = (
  connection: Connection,
  aggregator?: ConfigAggregator
): Effect.Effect<Org, Error> =>
  Effect.tryPromise({
    try: () => Org.create({ connection, aggregator }),
    catch: error => new Error('Failed to create Org', { cause: error })
  }).pipe(Effect.withSpan('Org.create'));
