/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ApexLogId, UserId } from '@salesforce/apex-node';
import { ApexLogService } from '../../../src/core/apexLogService';
import { ConnectionService, FailedToCreateConnectionError } from '../../../src/core/connectionService';

const userId = Schema.decodeUnknownSync(UserId)('0053t000007OxppAAC');
const logId = Schema.decodeUnknownSync(ApexLogId)('07Lxx00000cxy6YUAQ');

const makeService = () => {
  const query = vi.fn().mockResolvedValue({ totalSize: 0, done: true, records: [] });
  const request = vi.fn().mockResolvedValue('body');
  const connection = {
    tooling: { query },
    request,
    instanceUrl: 'https://example.my.salesforce.com',
    getApiVersion: () => '67.0'
  } as unknown as Connection;
  const getConnection = vi.fn<ConnectionService['getConnection']>(() => Effect.succeed(connection));
  const service = Effect.runSync(
    ApexLogService.pipe(
      Effect.provide(ApexLogService.DefaultWithoutDependencies),
      Effect.provideService(ConnectionService, {
        getConnection: () => Effect.suspend(getConnection)
      } as unknown as ConnectionService)
    )
  );
  return { service, query, request, getConnection, connection };
};

describe('ApexLogService', () => {
  it.each([
    [
      { message: 'Bad SOQL', errorCode: 'MALFORMED_QUERY' },
      { _tag: 'SoqlError', statusCode: 400 }
    ],
    [
      { message: 'Bad field', errorCode: 'INVALID_FIELD', fields: ['Operation'], statusCode: 403 },
      { _tag: 'FieldError', fields: ['Operation'], statusCode: 403 }
    ],
    [
      { message: 'Bad field', errorCode: 'INVALID_FIELD' },
      { _tag: 'SoqlError', statusCode: 400 }
    ],
    [new Error('Network error'), { _tag: 'UnknownException' }]
  ])('preserves query error tags for %j', async (cause, expected) => {
    const { service, query } = makeService();
    query.mockRejectedValue(cause);
    expect(await Effect.runPromise(Effect.flip(service.listLogs()))).toMatchObject(expected);
  });

  it('preserves response decoding and body-fetch errors', async () => {
    const { service, query, request } = makeService();
    query.mockResolvedValue({ totalSize: 1, records: [{ Id: 'bad' }] });
    expect(await Effect.runPromise(Effect.flip(service.listLogs()))).toMatchObject({ _tag: 'ParseError' });
    const cause = new Error('not found');
    request.mockRejectedValue(cause);
    expect(await Effect.runPromise(Effect.flip(service.getLogBody(logId)))).toMatchObject({
      _tag: 'ApexLogBodyFetchError',
      message: 'Failed to fetch ApexLog body: not found',
      cause
    });
  });

  it('uses apex-node defaults and passes public filters through', async () => {
    const { service, query } = makeService();
    await Effect.runPromise(service.listLogs());
    expect(query.mock.calls[0][0]).toContain('ORDER BY StartTime DESC, Id DESC');
    expect(query.mock.calls[0][0]).not.toContain(' LIMIT ');
    await Effect.runPromise(service.listLogs({ userIds: [userId], operationContains: 'executeAnonymous' }));
    expect(query.mock.calls[1][0]).toContain(
      `WHERE LogUserId IN ('${userId}') AND Operation LIKE '%executeAnonymous%' ORDER BY StartTime DESC, Id DESC`
    );
  });

  it('maps scheduled query errors to the public tags and continues the next poll', async () => {
    const { service, query } = makeService();
    query.mockRejectedValueOnce({ message: 'Bad SOQL', errorCode: 'MALFORMED_QUERY' }).mockResolvedValue({
      totalSize: 1,
      records: [{ Id: logId, LogLength: 10, StartTime: '2026-10-23T12:00:00.000Z', Status: 'Success' }]
    });
    const events = await Effect.runPromise(
      service.streamLogs({ schedule: Schedule.recurs(1) }).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
    );
    expect(events).toMatchObject([
      { _tag: 'QueryError', error: { _tag: 'SoqlError', errorCode: 'MALFORMED_QUERY' } },
      { _tag: 'Log', log: { Id: logId }, body: 'body' }
    ]);
  });

  it('retries connection setup on the schedule and reacquires the connection for later polls', async () => {
    const { service, query, request, getConnection, connection } = makeService();
    getConnection.mockImplementationOnce(() =>
      Effect.fail(new FailedToCreateConnectionError({ message: 'temporary connection failure' }))
    );
    query.mockResolvedValue({
      totalSize: 1,
      records: [{ Id: logId, LogLength: 10, StartTime: '2026-10-23T12:00:00.000Z', Status: 'Success' }]
    });
    const refreshedQuery = vi.fn().mockResolvedValue({
      totalSize: 1,
      records: [{ Id: '07Lxx00000cxy6YUBA', LogLength: 10, StartTime: '2026-10-23T12:01:00.000Z', Status: 'Success' }]
    });
    getConnection.mockImplementationOnce(() => Effect.succeed(connection));
    getConnection.mockImplementation(() =>
      Effect.succeed({
        tooling: { query: refreshedQuery },
        request,
        instanceUrl: connection.instanceUrl,
        getApiVersion: () => connection.getApiVersion()
      } as unknown as Connection)
    );
    const events = await Effect.runPromise(
      service.streamLogs({ schedule: Schedule.recurs(2) }).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
    );
    expect(events).toMatchObject([
      { _tag: 'QueryError', error: { _tag: 'FailedToCreateConnectionError', message: 'temporary connection failure' } },
      { _tag: 'Log', log: { Id: logId } },
      { _tag: 'Log', log: { Id: '07Lxx00000cxy6YUBA' } }
    ]);
    expect(getConnection).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenCalledTimes(1);
    expect(refreshedQuery).toHaveBeenCalledTimes(1);
  });
});
