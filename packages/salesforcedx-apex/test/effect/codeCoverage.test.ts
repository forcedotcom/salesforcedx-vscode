/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { Mock } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Schema from 'effect/Schema';
import {
  getAggregateCodeCoverage,
  getOrgWideCoverage,
  getPerClassCodeCoverage,
  type ApexCodeCoverageRecord
} from '../../src/effect';
import { CodeCoverageResultSchema, PerClassCoverageSchema } from '../../src/effect/coverageSchemas';
import { ApexCodeCoverageRecordSchema } from '../../src/effect/schema/wire/coverage';
import { CodeCoverage } from '../../src/tests/codeCoverage';

const classId = '01p000000000001AAA';
const testClassId = '01p000000000002AAA';
const triggerId = '01q000000000001AAA';
const record: ApexCodeCoverageRecord = {
  ApexClassOrTrigger: { Id: classId, Name: 'CoveredClass' },
  ApexTestClassId: testClassId,
  TestMethodName: 'coversClass',
  NumLinesCovered: 2,
  NumLinesUncovered: 1,
  Coverage: { coveredLines: [2, 4], uncoveredLines: [9] }
};
const page = (records: unknown[]) => ({ done: true, totalSize: records.length, records });
const makeConnection = (query: Mock, queryMore = vi.fn()): Connection =>
  ({ tooling: { query, queryMore } }) as unknown as Connection;

describe('coverage Effect API', () => {
  it('validates class and trigger IDs in coverage schemas', () => {
    expect(Schema.is(ApexCodeCoverageRecordSchema)(record)).toBe(true);
    expect(
      Schema.is(ApexCodeCoverageRecordSchema)({
        ...record,
        ApexClassOrTrigger: { ...record.ApexClassOrTrigger, Id: '005000000000001AAA' }
      })
    ).toBe(false);
    expect(Schema.is(ApexCodeCoverageRecordSchema)({ ...record, ApexTestClassId: '07M000000000001AAA' })).toBe(false);
    expect(
      Schema.is(PerClassCoverageSchema)({
        apexClassOrTriggerName: 'CoveredTrigger',
        apexClassOrTriggerId: triggerId,
        apexTestClassId: testClassId,
        apexTestMethodName: 'coversTrigger',
        numLinesCovered: 2,
        numLinesUncovered: 1,
        percentage: '67%'
      })
    ).toBe(true);
    expect(
      Schema.is(CodeCoverageResultSchema)({
        apexId: triggerId,
        name: 'CoveredTrigger',
        type: 'ApexTrigger',
        numLinesCovered: 2,
        numLinesUncovered: 1,
        percentage: '67%',
        coveredLines: [2, 4],
        uncoveredLines: [9]
      })
    ).toBe(true);
    expect(
      Schema.is(CodeCoverageResultSchema)({
        apexId: '005000000000001AAA',
        name: 'NotApex',
        type: 'ApexClass',
        numLinesCovered: 0,
        numLinesUncovered: 0,
        percentage: '0%',
        coveredLines: [],
        uncoveredLines: []
      })
    ).toBe(false);
  });

  it.each(['33', 33])('normalizes org-wide coverage %s to a percentage string', async PercentCovered => {
    const query = vi.fn().mockResolvedValue(page([{ PercentCovered }]));

    await expect(Effect.runPromise(getOrgWideCoverage(makeConnection(query)))).resolves.toBe('33%');
    expect(query).toHaveBeenCalledWith('SELECT PercentCovered FROM ApexOrgWideCoverage');
  });

  it.each(['0', 0, '100', 100, '33.5', 33.5])('accepts boundary and fractional coverage %s', async PercentCovered => {
    await expect(
      Effect.runPromise(getOrgWideCoverage(makeConnection(vi.fn().mockResolvedValue(page([{ PercentCovered }])))))
    ).resolves.toBe(`${PercentCovered}%`);
  });

  it.each(['garbage', '', 'NaN', 'Infinity', '-1', '101', -1, 101, NaN, Infinity])(
    'rejects invalid org-wide coverage %s with its field and schema message',
    async PercentCovered => {
      const result = await Effect.runPromise(
        getOrgWideCoverage(makeConnection(vi.fn().mockResolvedValue(page([{ PercentCovered }])))).pipe(Effect.flip)
      );
      expect(result).toMatchObject({
        _tag: 'ApexResponseDecodeError',
        operation: 'getOrgWideCoverage',
        message: expect.stringContaining('Coverage percentage must be a finite number from 0 to 100')
      });
      expect(result.message).toContain('PercentCovered');
    }
  );

  it.each([
    { field: 'NumLinesCovered', value: -1 },
    { field: 'NumLinesUncovered', value: -1 },
    { field: 'NumLinesCovered', value: 1.5 },
    { field: 'NumLinesCovered', value: NaN },
    { field: 'NumLinesCovered', value: Infinity }
  ])('rejects invalid $field=$value before calculating coverage', async ({ field, value }) => {
    const connection = makeConnection(vi.fn().mockResolvedValue(page([{ ...record, [field]: value }])));
    const result = await Effect.runPromise(getAggregateCodeCoverage(connection, new Set()).pipe(Effect.flip));

    expect(result).toMatchObject({
      _tag: 'ApexResponseDecodeError',
      message: expect.stringContaining('Coverage line counts must be non-negative integers')
    });
    expect(result.message).toContain(field);
  });

  it.each([-1, 0, 1.5, NaN, Infinity])('rejects invalid coverage line %s through the Promise adapter', async line => {
    const connection = makeConnection(
      vi.fn().mockResolvedValue(page([{ ...record, Coverage: { coveredLines: [line], uncoveredLines: [] } }]))
    );

    await expect(new CodeCoverage(connection).getAggregateCodeCoverage(new Set())).rejects.toThrow(
      'Coverage line numbers must be positive integers'
    );
  });

  it('returns 0% when no org-wide coverage exists', async () => {
    await expect(
      Effect.runPromise(getOrgWideCoverage(makeConnection(vi.fn().mockResolvedValue(page([])))))
    ).resolves.toBe('0%');
  });

  it('does not query for an empty per-test class set', async () => {
    const query = vi.fn();
    await expect(Effect.runPromise(getPerClassCodeCoverage(makeConnection(query), new Set()))).resolves.toEqual(
      new Map()
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('groups all covered classes by test class and method across Tooling pages', async () => {
    const query = vi.fn().mockResolvedValue({
      done: false,
      totalSize: 3,
      records: [record],
      nextRecordsUrl: '/coverage/page/2'
    });
    const queryMore = vi.fn().mockResolvedValue(
      page([
        { ...record, ApexClassOrTrigger: { Id: triggerId, Name: 'CoveredTrigger' } },
        { ...record, TestMethodName: 'otherTest', Coverage: undefined }
      ])
    );

    const result = await Effect.runPromise(
      getPerClassCodeCoverage(makeConnection(query, queryMore), new Set([testClassId]))
    );

    expect(queryMore).toHaveBeenCalledExactlyOnceWith('/coverage/page/2');
    expect(result.get(`${testClassId}-coversClass`)).toEqual([
      {
        apexClassOrTriggerName: 'CoveredClass',
        apexClassOrTriggerId: classId,
        apexTestClassId: testClassId,
        apexTestMethodName: 'coversClass',
        numLinesCovered: 2,
        numLinesUncovered: 1,
        percentage: '67%',
        coverage: record.Coverage
      },
      {
        apexClassOrTriggerName: 'CoveredTrigger',
        apexClassOrTriggerId: triggerId,
        apexTestClassId: testClassId,
        apexTestMethodName: 'coversClass',
        numLinesCovered: 2,
        numLinesUncovered: 1,
        percentage: '67%',
        coverage: record.Coverage
      }
    ]);
    expect(result.get(`${testClassId}-otherTest`)).toEqual([
      expect.objectContaining({ apexTestMethodName: 'otherTest', percentage: '67%' })
    ]);
    expect(result.get(`${testClassId}-otherTest`)?.[0]).not.toHaveProperty('coverage');
    expect(result.size).toBe(2);
  });

  it('normalizes aggregates and totals across all pages without an ID filter for aggregate-only orgs', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ done: false, totalSize: 2, records: [record], nextRecordsUrl: '/coverage/page/2' });
    const queryMore = vi.fn().mockResolvedValue(
      page([
        {
          ...record,
          ApexClassOrTrigger: { Id: triggerId, Name: 'UncoveredTrigger' },
          NumLinesCovered: 0,
          NumLinesUncovered: 2,
          Coverage: { coveredLines: [], uncoveredLines: [3, 8] }
        }
      ])
    );

    const result = await Effect.runPromise(getAggregateCodeCoverage(makeConnection(query, queryMore), new Set()));

    expect(query.mock.calls[0][0]).not.toContain('WHERE');
    expect(queryMore).toHaveBeenCalledExactlyOnceWith('/coverage/page/2');
    expect(result).toEqual({
      coveredLines: 2,
      totalLines: 5,
      codeCoverageResults: [
        {
          apexId: classId,
          name: 'CoveredClass',
          type: 'ApexClass',
          numLinesCovered: 2,
          numLinesUncovered: 1,
          percentage: '67%',
          coveredLines: [2, 4],
          uncoveredLines: [9]
        },
        {
          apexId: triggerId,
          name: 'UncoveredTrigger',
          type: 'ApexTrigger',
          numLinesCovered: 0,
          numLinesUncovered: 2,
          percentage: '0%',
          coveredLines: [],
          uncoveredLines: [3, 8]
        }
      ]
    });
  });

  it('returns zero totals for an empty aggregate table', async () => {
    await expect(
      Effect.runPromise(getAggregateCodeCoverage(makeConnection(vi.fn().mockResolvedValue(page([]))), new Set()))
    ).resolves.toEqual({ codeCoverageResults: [], totalLines: 0, coveredLines: 0 });
  });

  it.each(['perClass', 'aggregate'] as const)(
    'batches %s class filters at 500 IDs and follows each batch cursor',
    async kind => {
      const ids = Array.from({ length: 1001 }, (_, i) => `01p${String(i).padStart(15, '0')}`);
      const query = vi.fn().mockImplementation(async (soql: string) => ({
        done: false,
        totalSize: 1,
        records: [],
        nextRecordsUrl: `/coverage/${ids.findIndex(id => soql.includes(id))}`
      }));
      const queryMore = vi.fn().mockResolvedValue(page([record]));

      const connection = makeConnection(query, queryMore);
      const idSet = new Set(ids);
      await (
        kind === 'perClass'
          ? getPerClassCodeCoverage(connection, idSet).pipe(Effect.asVoid)
          : getAggregateCodeCoverage(connection, idSet).pipe(Effect.asVoid)
      ).pipe(Effect.runPromise);

      expect(query.mock.calls.map(([soql]) => soql.match(/'[^']+'/g)?.length)).toEqual([500, 500, 1]);
      expect(queryMore.mock.calls.map(([url]) => url)).toEqual(['/coverage/0', '/coverage/500', '/coverage/1000']);
      expect(query.mock.calls.map(([soql]) => soql.slice(soql.indexOf(' IN (') + 5, -1)).join(',')).toBe(
        ids.map(id => `'${id}'`).join(',')
      );
    }
  );

  it('leaves zero executable lines at 0%', async () => {
    const query = vi.fn().mockResolvedValue(page([{ ...record, NumLinesCovered: 0, NumLinesUncovered: 0 }]));
    const result = await Effect.runPromise(getAggregateCodeCoverage(makeConnection(query), new Set([classId])));
    expect(result.codeCoverageResults[0].percentage).toBe('0%');
    expect(result.totalLines).toBe(0);
    expect(result.coveredLines).toBe(0);
  });

  it('defers requests until the Effect runs', async () => {
    const query = vi.fn().mockResolvedValue(page([]));
    const operation = getAggregateCodeCoverage(makeConnection(query), new Set([classId]));
    expect(query).not.toHaveBeenCalled();
    await Effect.runPromise(operation);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reports query failures as typed operation errors', async () => {
    const query = vi.fn().mockRejectedValue(new Error('coverage unavailable'));
    await expect(
      Effect.runPromise(getAggregateCodeCoverage(makeConnection(query), new Set()).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      operation: 'getAggregateCodeCoverage',
      message: 'coverage unavailable',
      cause: 'coverage unavailable'
    });
  });

  it('reports continuation failures without returning partial coverage', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ done: false, totalSize: 2, records: [record], nextRecordsUrl: '/coverage/page/2' });
    const queryMore = vi.fn().mockRejectedValue(new Error('cursor expired'));
    await expect(
      Effect.runPromise(
        getPerClassCodeCoverage(makeConnection(query, queryMore), new Set([testClassId])).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      operation: 'getPerClassCodeCoverage',
      message: 'cursor expired'
    });
  });

  it.each([
    { done: true, totalSize: 1, records: [{ ...record, Coverage: { coveredLines: ['2'], uncoveredLines: [] } }] },
    { done: false, totalSize: 2, records: [record] }
  ])('rejects malformed records or missing continuation URLs', async response => {
    const queryMore = vi.fn();
    const connection = makeConnection(vi.fn().mockResolvedValue(response), queryMore);
    await expect(
      Effect.runPromise(getAggregateCodeCoverage(connection, new Set([classId])).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: 'ApexResponseDecodeError', operation: 'getAggregateCodeCoverage' });
    expect(queryMore).not.toHaveBeenCalled();
  });

  it('stops pagination when the calling fiber is interrupted', async () => {
    const queryMore = vi.fn();
    let finishQuery: ((result: unknown) => void) | undefined;
    const started = Promise.withResolvers<void>();
    const query = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          finishQuery = resolve;
          started.resolve();
        })
    );
    const fiber = Effect.runFork(getAggregateCodeCoverage(makeConnection(query, queryMore), new Set()));
    await started.promise;
    await Effect.runPromise(Fiber.interrupt(fiber));
    finishQuery?.({ done: false, totalSize: 2, records: [record], nextRecordsUrl: '/coverage/page/2' });
    await Promise.resolve();
    expect(queryMore).not.toHaveBeenCalled();
  });

  it('keeps Promise adapter errors free of FiberFailure prefixes', async () => {
    const query = vi.fn().mockRejectedValue(new Error('coverage unavailable'));
    const coverage = new CodeCoverage(makeConnection(query));
    await expect(coverage.getOrgWideCoverage()).rejects.toThrow(/^coverage unavailable$/);
  });
});
