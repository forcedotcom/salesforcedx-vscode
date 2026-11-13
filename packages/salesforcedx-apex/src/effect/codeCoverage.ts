/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { QUERY_RECORD_LIMIT } from '../tests/constants.js';
import { type AggregateCodeCoverageResult, type PerClassCoverage } from './coverageSchemas.js';
import { ApexOperationError, ApexResponseDecodeError } from './schema/errors.js';
import { QueryPageSchema } from './schema/queryPage.js';
import {
  ApexCodeCoverageAggregateRecordSchema,
  ApexCodeCoverageRecordSchema,
  ApexOrgWideCoverageQueryRecordSchema,
  type ApexCodeCoverageRecord
} from './schema/wire/coverage.js';

const perClassQuery =
  'SELECT ApexTestClassId, ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, TestMethodName, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverage WHERE ApexTestClassId IN (%s)';
const aggregateQuery =
  'SELECT ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate';

const createQueries = <Id extends string>(query: string, ids: ReadonlySet<Id>): string[] =>
  Arr.chunksOf(Array.from(ids), QUERY_RECORD_LIMIT).map(chunk =>
    query.replace('%s', () => chunk.map(id => `'${id.replaceAll("'", "\\'")}'`).join(','))
  );

const queryCoverageRecords = <S extends Schema.ConstraintDecoder<unknown, never>>(
  connection: Connection,
  query: string,
  recordSchema: S,
  operation: string
) => {
  const pageSchema = QueryPageSchema(recordSchema);
  const initialNextRecordsUrl: string | undefined = undefined;
  return Stream.paginate<string | undefined, S['Type'], ApexOperationError | ApexResponseDecodeError, never>(
    initialNextRecordsUrl,
    nextRecordsUrl =>
      Effect.tryPromise({
        try: () =>
          Promise.resolve(
            isUndefined(nextRecordsUrl) ? connection.tooling.query(query) : connection.tooling.queryMore(nextRecordsUrl)
          ),
        catch: cause =>
          new ApexOperationError({ operation, message: getErrorMessage(cause), cause: getErrorMessage(cause) })
      }).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(pageSchema)),
        Effect.map(page => [page.records, page.done ? Option.none() : Option.some(page.nextRecordsUrl)] as const),
        Effect.catchTag('SchemaError', cause =>
          Effect.fail(
            new ApexResponseDecodeError({
              operation,
              message: cause.message,
              cause: getErrorMessage(cause)
            })
          )
        )
      )
  ).pipe(Stream.runCollect);
};

const percentage = (covered: number, total: number): string =>
  covered > 0 ? `${((covered / total) * 100).toFixed()}%` : '0%';

const toPerClassCoverage = (record: ApexCodeCoverageRecord): PerClassCoverage => ({
  apexClassOrTriggerName: record.ApexClassOrTrigger.Name,
  apexClassOrTriggerId: record.ApexClassOrTrigger.Id,
  apexTestClassId: record.ApexTestClassId,
  apexTestMethodName: record.TestMethodName,
  numLinesCovered: record.NumLinesCovered,
  numLinesUncovered: record.NumLinesUncovered,
  percentage: percentage(record.NumLinesCovered, record.NumLinesCovered + record.NumLinesUncovered),
  ...(record.Coverage ? { coverage: record.Coverage } : {})
});

/** Retrieves the org-wide coverage percentage, or 0% when the org has no coverage record. */
export const getOrgWideCoverage = Effect.fn('Apex.getOrgWideCoverage')(function* (connection: Connection) {
  return yield* queryCoverageRecords(
    connection,
    'SELECT PercentCovered FROM ApexOrgWideCoverage',
    // Tooling returns PercentCovered as a number; legacy callers also supply string-valued records.
    ApexOrgWideCoverageQueryRecordSchema,
    'getOrgWideCoverage'
  ).pipe(Effect.map(records => `${records[0]?.PercentCovered ?? 0}%`));
});

/** Groups coverage by test class ID and method name; one test can cover several classes or triggers. */
export const getPerClassCodeCoverage = Effect.fn('Apex.getPerClassCodeCoverage')(function* (
  connection: Connection,
  apexTestClassIds: ReadonlySet<string>
) {
  return yield* Effect.forEach(
    createQueries(perClassQuery, apexTestClassIds),
    query => queryCoverageRecords(connection, query, ApexCodeCoverageRecordSchema, 'getPerClassCodeCoverage'),
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.map(
      records =>
        new Map<string, PerClassCoverage[]>(
          Object.entries(
            Arr.groupBy(
              records.flat().map(toPerClassCoverage),
              item => `${item.apexTestClassId}-${item.apexTestMethodName}`
            )
          )
        )
    )
  );
});

/** Retrieves aggregate coverage; an empty ID set queries all classes and triggers for aggregate-only orgs. */
export const getAggregateCodeCoverage = Effect.fn('Apex.getAggregateCodeCoverage')(function* (
  connection: Connection,
  apexClassIds: ReadonlySet<string>
) {
  // Preserve "Store Only Aggregate Code Coverage": no per-test records means query the entire aggregate table.
  return yield* Effect.forEach(
    apexClassIds.size === 0
      ? [aggregateQuery]
      : createQueries(`${aggregateQuery} WHERE ApexClassorTriggerId IN (%s)`, apexClassIds),
    query => queryCoverageRecords(connection, query, ApexCodeCoverageAggregateRecordSchema, 'getAggregateCodeCoverage'),
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.map(recordPages => {
      const records = recordPages.flat();
      return {
        codeCoverageResults: records.map(item => ({
          apexId: item.ApexClassOrTrigger.Id,
          name: item.ApexClassOrTrigger.Name,
          type: item.ApexClassOrTrigger.Id.startsWith('01p') ? 'ApexClass' : 'ApexTrigger',
          numLinesCovered: item.NumLinesCovered,
          numLinesUncovered: item.NumLinesUncovered,
          percentage: percentage(item.NumLinesCovered, item.NumLinesCovered + item.NumLinesUncovered),
          coveredLines: item.Coverage.coveredLines,
          uncoveredLines: item.Coverage.uncoveredLines
        })),
        totalLines: records.reduce((sum, item) => sum + item.NumLinesCovered + item.NumLinesUncovered, 0),
        coveredLines: records.reduce((sum, item) => sum + item.NumLinesCovered, 0)
      } satisfies AggregateCodeCoverageResult;
    })
  );
});
