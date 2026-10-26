/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import { getLogBody, listLogs, streamLogs } from '../../src/effect/logs';

const log = (Id: string) => ({ Id, LogLength: 10, StartTime: '2026-10-23T12:00:00.000Z', Status: 'Success' });
const makeConnection = () => {
  const query = vi.fn().mockResolvedValue({ totalSize: 0, done: true, records: [] });
  const queryMore = vi.fn();
  const request = vi.fn().mockResolvedValue('body');
  const connection = {
    tooling: { query, queryMore },
    request,
    instanceUrl: 'https://example.my.salesforce.com',
    getApiVersion: () => '67.0'
  } as unknown as Connection;
  return { connection, query, queryMore, request };
};

describe('Effect Apex logs', () => {
  it('preserves filters, quote escaping, descending order, and default limit', async () => {
    const { connection, query } = makeConnection();
    await Effect.runPromise(listLogs(connection));
    expect(query.mock.calls[0][0]).toBe(
      'SELECT Id, Application, DurationMilliseconds, LogLength, LogUserId, LogUser.Name, Operation, StartTime, Status FROM ApexLog ORDER BY StartTime DESC, Id DESC LIMIT 25'
    );
    await Effect.runPromise(
      listLogs(connection, 7, {
        userId: 'ignored',
        userIds: ["005'one", '005two'],
        operationContains: "execute'Anonymous",
        startTimeAfter: '2026-10-23T00:00:00.000Z'
      })
    );
    expect(query.mock.calls[1][0]).toContain(
      "WHERE LogUserId IN ('005''one','005two') AND Operation LIKE '%execute''Anonymous%' AND StartTime >= 2026-10-23T00:00:00.000Z ORDER BY StartTime DESC, Id DESC LIMIT 7"
    );
    await Effect.runPromise(listLogs(connection, 5, { userId: "005'one", userIds: [] }));
    expect(query.mock.calls[2][0]).toContain("WHERE LogUserId = '005''one' ORDER BY StartTime DESC, Id DESC LIMIT 5");
    await Effect.runPromise(
      listLogs(connection, 500, {
        startTimeAfter: '2026-10-23T00:00:00.000Z',
        cursor: { startTime: '2026-10-23T12:00:00.000Z', id: "07L'one" },
        orderBy: 'ASC'
      })
    );
    expect(query.mock.calls[3][0]).toContain(
      "StartTime >= 2026-10-23T00:00:00.000Z AND (StartTime > 2026-10-23T12:00:00.000Z OR (StartTime = 2026-10-23T12:00:00.000Z AND Id > '07L''one')) ORDER BY StartTime ASC, Id ASC LIMIT 500"
    );
    await Effect.runPromise(
      listLogs(connection, 500, { cursor: { startTime: '2026-10-23T12:00:00.000Z' }, orderBy: 'ASC' })
    );
    expect(query.mock.calls[4][0]).toContain(
      'WHERE StartTime >= 2026-10-23T12:00:00.000Z ORDER BY StartTime ASC, Id ASC LIMIT 500'
    );
  });

  it('follows pages and normalizes nullable optional fields', async () => {
    const { connection, query, queryMore } = makeConnection();
    query.mockResolvedValue({ totalSize: 2, done: false, nextRecordsUrl: '/next', records: [log('1')] });
    queryMore.mockResolvedValue({ totalSize: 2, done: true, records: [{ ...log('2'), LogUser: null }] });
    expect(await Effect.runPromise(listLogs(connection))).toEqual([log('1'), { ...log('2'), LogUser: undefined }]);
    expect(queryMore).toHaveBeenCalledWith('/next');
  });

  it('preserves request causes and reports malformed records', async () => {
    const { connection, query } = makeConnection();
    const cause = { message: 'Invalid field', errorCode: 'INVALID_FIELD', fields: ['Operation'] };
    query.mockRejectedValueOnce(cause);
    expect(await Effect.runPromise(Effect.flip(listLogs(connection)))).toMatchObject({
      _tag: 'ApexLogQueryError',
      cause,
      soql: expect.stringContaining('FROM ApexLog')
    });
    query.mockResolvedValue({ totalSize: 1, records: [{ Id: 'invalid' }] });
    expect(await Effect.runPromise(Effect.flip(listLogs(connection)))).toMatchObject({ _tag: 'ParseError' });
  });

  it('retrieves bodies and preserves string conversion and tagged failures', async () => {
    const { connection, request } = makeConnection();
    request.mockResolvedValueOnce(123);
    expect(await Effect.runPromise(getLogBody(connection, '07Lone'))).toBe('123');
    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://example.my.salesforce.com/services/data/v67.0/tooling/sobjects/ApexLog/07Lone/Body'
    });
    const cause = new Error('body unavailable');
    request.mockRejectedValueOnce(cause);
    expect(await Effect.runPromise(Effect.flip(getLogBody(connection, '07Lone')))).toMatchObject({
      _tag: 'ApexLogBodyFetchError',
      message: 'Failed to fetch ApexLog body: body unavailable',
      cause
    });
  });

  it('keeps polling after query/body failures and filters before fetching bodies', async () => {
    const { connection, query, request } = makeConnection();
    query.mockRejectedValueOnce(new Error('query unavailable')).mockResolvedValue({
      totalSize: 3,
      records: [log('skip'), log('bad'), log('good')]
    });
    request.mockRejectedValueOnce(new Error('body unavailable'));
    const events = await Effect.runPromise(
      streamLogs(connection, {
        schedule: Schedule.recurs(1),
        filterLogs: logs => Effect.succeed(logs.filter(item => item.Id !== 'skip'))
      }).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
    );
    expect(events.map(event => event._tag)).toEqual(['QueryError', 'BodyError', 'Log']);
    expect(request.mock.calls.map(([options]) => options.url.split('/').at(-2))).toEqual(['bad', 'good']);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('lets the caller gate polls and update filters without ending the schedule', async () => {
    const { connection, query } = makeConnection();
    await Effect.runPromise(
      streamLogs(connection, {
        schedule: Schedule.recurs(2),
        pollOptions: index => Effect.succeed(index === 1 ? Option.none() : Option.some({ userId: `005${index}` }))
      }).pipe(Stream.runDrain)
    );
    expect(query.mock.calls.map(([soql]) => soql.match(/LogUserId = '([^']+)'/)[1])).toEqual(['0050', '0052']);
  });

  it('interrupts in-flight body retrieval without emitting a log', async () => {
    const { connection, query, request } = makeConnection();
    query.mockResolvedValue({ totalSize: 1, records: [log('pending')] });
    const events = vi.fn();
    await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        request.mockImplementation(() => {
          Effect.runSync(Deferred.succeed(started, undefined));
          return new Promise<string>(() => {});
        });
        const fiber = yield* streamLogs(connection, { schedule: Schedule.recurs(0) }).pipe(
          Stream.runForEach(event => Effect.sync(() => events(event))),
          Effect.fork
        );
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
      })
    );
    expect(events).not.toHaveBeenCalled();
  });
});
