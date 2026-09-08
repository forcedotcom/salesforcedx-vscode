/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { ApexConnectionProvider, makeApexConnectionProvider } from '../capabilities/connection';

/** Promise boundary shared by traditional class facades while their implementation moves to Effect. */
export class ApexClassRunner {
  private readonly connectionProvider: ApexConnectionProvider;

  public constructor(connection: Connection) {
    this.connectionProvider = makeApexConnectionProvider(connection);
  }

  public runPromise<A, E>(operation: Effect.Effect<A, E, ApexConnectionProvider>): Promise<A> {
    return Effect.runPromise(Effect.provideService(operation, ApexConnectionProvider, this.connectionProvider));
  }
}
