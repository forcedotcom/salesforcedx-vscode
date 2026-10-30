/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { PerClassCoverage } from './types';
import type { AggregateCodeCoverageResult } from '../effect/coverageSchemas';
import type { ApexOperationError, ApexResponseDecodeError } from '../effect/schema/errors';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { getAggregateCodeCoverage, getOrgWideCoverage, getPerClassCodeCoverage } from '../effect/codeCoverage';
import { HeapMonitor } from '../utils/heapMonitor';

const runCoverage = async <A>(
  operation: Effect.Effect<A, ApexOperationError | ApexResponseDecodeError>,
  name: string
): Promise<A> => {
  HeapMonitor.getInstance().checkHeapSize(name);
  try {
    const result = await operation.pipe(Effect.either, Effect.runPromise);
    // Preserve plain Promise rejection messages rather than exposing a FiberFailure prefix to CLI callers.
    if (Either.isLeft(result)) throw new Error(result.left.message);
    return result.right;
  } finally {
    HeapMonitor.getInstance().checkHeapSize(name);
  }
};

/** Promise adapter; retrieval and normalization belong to the Effect API. */
export class CodeCoverage {
  constructor(public readonly connection: Connection) {}

  public async getOrgWideCoverage(): Promise<string> {
    return runCoverage(getOrgWideCoverage(this.connection), 'codeCoverage.getOrgWideCoverage');
  }

  public async getPerClassCodeCoverage(
    apexTestClassSet: ReadonlySet<string>
  ): Promise<Map<string, PerClassCoverage[]>> {
    return runCoverage(
      getPerClassCodeCoverage(this.connection, apexTestClassSet),
      'codeCoverage.getPerClassCodeCoverage'
    );
  }

  public async getAggregateCodeCoverage(apexClassIdSet: ReadonlySet<string>): Promise<AggregateCodeCoverageResult> {
    return runCoverage(
      getAggregateCodeCoverage(this.connection, apexClassIdSet),
      'codeCoverage.getAggregateCodeCoverage'
    );
  }
}
