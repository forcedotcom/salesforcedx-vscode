/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { buildSyncPayload, formatSyncResults, runTestSynchronous, TestResultSchema } from '../../src/effect';
import { messages } from '../../src/i18n/i18n';
import { SyncTests } from '../../src/tests/syncTests';
import { type SyncTestConfiguration, TestResultSchema as PublicTestResultSchema } from '../../src/tests/types';

const classId = '01p000000000001AAA';
const response = {
  apexLogId: '07L000000000001AAA',
  numFailures: 0,
  numTestsRun: 1,
  totalTime: 1,
  successes: [{ id: classId, methodName: 'testOne', name: 'Example', namespace: null, seeAllData: false, time: 1 }],
  failures: []
};
const makeConnection = (request = vi.fn().mockResolvedValue(response)): Connection =>
  ({
    instanceUrl: 'https://example.my.salesforce.com',
    getAuthInfoFields: () => ({ orgId: '00D000000000001AAA' }),
    getUsername: () => 'test@example.com',
    getConnectionOptions: () => ({}),
    tooling: { _baseUrl: () => '/tooling', request }
  }) as unknown as Connection;

describe('synchronous schema validation', () => {
  it.each<SyncTestConfiguration>([
    {},
    { tests: [] },
    { tests: [{}] },
    { tests: [{ className: 'One' }, { className: 'Two' }] },
    { tests: [{ className: 'One', classId }] },
    { tests: [{ className: ' ' }] },
    { tests: [{ classId: '005000000000001AAA' }] },
    { tests: [{ className: 'One', testMethods: [''] }] },
    { tests: [{ className: 'Two' }], classNames: 'One' },
    { classNames: 'One,Two' },
    { classNames: 'One', testLevel: 'RunLocalTests' },
    { classNames: 'One', maxFailedTests: -1 },
    { classNames: 'One', maxFailedTests: 1.5 },
    { classNames: 'One', maxFailedTests: 1_000_001 },
    { classNames: 'One', maxFailedTests: NaN },
    { classNames: 'One', maxFailedTests: Infinity },
    { category: [] }
  ])('rejects invalid request %# before sending it', async options => {
    const request = vi.fn();
    const result = await Effect.runPromise(runTestSynchronous(makeConnection(request), options).pipe(Effect.flip));

    expect(result).toMatchObject({ _tag: 'ApexOperationError', operation: 'runTestSynchronous' });
    expect(result.message).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });

  it('explains conflicting selectors through the Promise adapter', async () => {
    await expect(
      new SyncTests(makeConnection()).runTests({ tests: [{ className: 'One' }], classNames: 'Two' })
    ).rejects.toThrow('Specify tests or classNames, not both');
  });

  it.each([0, 1_000_000])(
    'allows repeated class selections, multiple methods, and failure limit %s',
    async maxFailedTests => {
      const request = vi.fn().mockResolvedValue(response);
      const options = {
        tests: [
          { classId, testMethods: ['first', 'second'] },
          { classId, testMethods: ['third'] }
        ],
        testLevel: 'RunSpecifiedTests',
        maxFailedTests
      };
      const result = await Effect.runPromise(runTestSynchronous(makeConnection(request), options));

      expect(JSON.parse(request.mock.calls[0][0].body)).toEqual(options);
      expect(Schema.is(TestResultSchema)(result)).toBe(true);
      expect(Schema.is(PublicTestResultSchema)(result)).toBe(true);
    }
  );

  it('validates the builder and direct requests with the same single-class rule', async () => {
    const connection = makeConnection();
    const options = { testLevel: 'RunSpecifiedTests' as const, tests: classId };

    const payload = await Effect.runPromise(buildSyncPayload(connection, options));
    expect(payload).toMatchObject({ tests: [{ classId }] });
    await expect(Effect.runPromise(runTestSynchronous(connection, payload))).resolves.toMatchObject({
      summary: { outcome: 'Passed' }
    });

    const invalid = await Effect.runPromise(
      buildSyncPayload(connection, { testLevel: 'RunSpecifiedTests', classNames: 'One,Two' }).pipe(Effect.flip)
    );
    expect(invalid.message).toContain(messages.syncClassErr);
  });

  it.each([
    { ...response, apexLogId: 'not-a-log-id' },
    { ...response, successes: [{ ...response.successes[0], id: '005000000000001AAA' }] }
  ])('rejects malformed response IDs rather than returning an invalid result %#', async invalidResponse => {
    const result = await Effect.runPromise(
      formatSyncResults(makeConnection(), invalidResponse, Date.now()).pipe(Effect.flip)
    );

    expect(result).toMatchObject({
      _tag: 'ApexResponseDecodeError',
      message: expect.stringContaining('ID must contain 15 or 18 alphanumeric characters')
    });
  });

  it('preserves response field errors through the Promise adapter', async () => {
    await expect(
      new SyncTests(makeConnection()).formatSyncResults({ ...response, apexLogId: 'bad' }, Date.now())
    ).rejects.toThrow('ApexLog ID must contain 15 or 18 alphanumeric characters and start with 07L');
  });
});
