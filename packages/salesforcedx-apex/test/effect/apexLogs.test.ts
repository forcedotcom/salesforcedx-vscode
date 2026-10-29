/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { Mock } from 'vitest';
import * as Chunk from 'effect/Chunk';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { getLogBody, getLogRecords, getLogs, listLogs, saveLog, streamLogs } from '../../src/effect';

const record = {
  Id: '07L000000000001AAA',
  Application: 'Unknown',
  DurationMilliseconds: 75,
  Location: 'SystemLog',
  LogLength: 450,
  LogUserId: '005000000000001AAA',
  LogUser: { Name: 'Test User', attributes: { type: 'User' } },
  Operation: 'executeAnonymous',
  Request: 'API',
  StartTime: '2026-10-29T10:00:00.000Z',
  Status: 'Success'
};

const makeConnection = (query = vi.fn(), request = vi.fn(), queryMore = vi.fn()): Connection =>
  ({
    tooling: { query, request, queryMore, _baseUrl: () => 'https://example.com/services/data/v66.0/tooling' }
  }) as unknown as Connection;

describe('Apex log Effect API', () => {
  it('queries the union of CLI and services fields and preserves user attributes', async () => {
    const query = vi.fn().mockResolvedValue({ records: [record], done: true });
    await expect(Effect.runPromise(listLogs(makeConnection(query)))).resolves.toEqual([record]);
    expect(query).toHaveBeenCalledWith(
      'SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, LogUser.Name, Operation, Request, StartTime, Status FROM ApexLog ORDER BY StartTime DESC, Id DESC'
    );
  });

  it('combines filters, escapes SOQL literals, and gives userIds precedence', async () => {
    const query = vi.fn().mockResolvedValue({ records: [] });
    await Effect.runPromise(
      listLogs(makeConnection(query), {
        userId: '005000000000003AAA',
        userIds: ['005000000000001AAA', '005000000000002AAA'],
        operationContains: "execute'\\Anonymous",
        startTimeAfter: '2026-10-29T10:00:00Z',
        limit: 30
      })
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("LogUserId IN ('005000000000001AAA','005000000000002AAA')")
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("Operation LIKE '%execute\\'\\\\Anonymous%'"));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('StartTime >= 2026-10-29T10:00:00.000Z'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 30'));
    expect(query.mock.calls[0][0]).not.toContain('005000000000003AAA');
  });

  it('uses userId when userIds is empty', async () => {
    const query = vi.fn().mockResolvedValue({ records: [] });
    await Effect.runPromise(listLogs(makeConnection(query), { userId: '005000000000001AAA', userIds: [] }));
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE LogUserId = '005000000000001AAA'"));
  });

  it('normalizes nullable fields and follows all query pages', async () => {
    const nullable = { ...record, Application: null, LogUser: null, Operation: null };
    const query = vi.fn().mockResolvedValue({ records: [nullable], done: false, nextRecordsUrl: '/next' });
    const queryMore = vi.fn().mockResolvedValue({ records: [{ ...record, Id: '07L000000000002AAA' }], done: true });
    const logs = await Effect.runPromise(listLogs(makeConnection(query, vi.fn(), queryMore)));
    expect(logs).toEqual([
      { ...nullable, Application: undefined, LogUser: undefined, Operation: undefined },
      { ...record, Id: '07L000000000002AAA' }
    ]);
    expect(queryMore).toHaveBeenCalledWith('/next');
  });

  it.each([0, -1])('rejects count %s with the CLI message before querying', async numberOfLogs => {
    const query = vi.fn();
    await expect(
      Effect.runPromise(Effect.flip(getLogRecords(makeConnection(query), numberOfLogs)))
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      message: 'Expected number of logs to be greater than 0.'
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('caps CLI counts at 25 without imposing that cap on listLogs', async () => {
    const query = vi.fn().mockResolvedValue({ records: [] });
    await Effect.runPromise(getLogRecords(makeConnection(query), 100));
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('LIMIT 25'));
    await Effect.runPromise(listLogs(makeConnection(query), { limit: 100 }));
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('LIMIT 100'));
  });

  it('rejects invalid timestamps before building SOQL', async () => {
    const query = vi.fn();
    await expect(
      Effect.runPromise(Effect.flip(listLogs(makeConnection(query), { startTimeAfter: 'yesterday OR Id != null' })))
    ).resolves.toMatchObject({ _tag: 'ApexOperationError' });
    expect(query).not.toHaveBeenCalled();
  });

  it('reports malformed records and transport failures as distinct typed errors', async () => {
    await expect(
      Effect.runPromise(Effect.flip(listLogs(makeConnection(vi.fn().mockResolvedValue({ records: [{ Id: 'bad' }] })))))
    ).resolves.toMatchObject({ _tag: 'ApexResponseDecodeError' });
    await expect(
      Effect.runPromise(Effect.flip(listLogs(makeConnection(vi.fn().mockRejectedValue(new Error('query failed'))))))
    ).resolves.toMatchObject({ _tag: 'ApexOperationError', operation: 'listLogs', cause: 'query failed' });
  });

  it('fetches a body using the supplied connection', async () => {
    const request = vi.fn().mockResolvedValue('raw\nbody');
    await expect(Effect.runPromise(getLogBody(makeConnection(vi.fn(), request), record.Id))).resolves.toBe('raw\nbody');
    expect(request).toHaveBeenCalledWith(
      `https://example.com/services/data/v66.0/tooling/sobjects/ApexLog/${record.Id}/Body`
    );
  });

  it('rejects an unfinished query page without a continuation URL', async () => {
    const query = vi.fn().mockResolvedValue({ records: [record], done: false });
    await expect(Effect.runPromise(Effect.flip(listLogs(makeConnection(query))))).resolves.toMatchObject({
      _tag: 'ApexResponseDecodeError'
    });
  });

  it.each([
    [null, ''],
    [undefined, ''],
    [123, '123'],
    ['', '']
  ])('normalizes body %s without losing empty logs', async (body, expected) => {
    await expect(
      Effect.runPromise(getLogBody(makeConnection(vi.fn(), vi.fn().mockResolvedValue(body)), record.Id))
    ).resolves.toBe(expected);
  });

  it('reports body failures on the typed error channel', async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(getLogBody(makeConnection(vi.fn(), vi.fn().mockRejectedValue(new Error('invalid id'))), record.Id))
      )
    ).resolves.toMatchObject({ _tag: 'ApexOperationError', operation: 'getLogBody', message: 'invalid id' });
  });

  it('requires an id or count, preserves empty-id selection, and gives count precedence', async () => {
    const query = vi.fn().mockResolvedValue({ records: [record] });
    const request = vi.fn().mockResolvedValue('body');
    const connection = makeConnection(query, request);
    await expect(Effect.runPromise(Effect.flip(getLogs(connection, {})))).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      message: 'To retrieve logs, specify the log ID or the number of logs.'
    });
    await expect(Effect.runPromise(getLogs(connection, { logId: '' }))).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    await expect(Effect.runPromise(getLogs(connection, { logId: 'ignored', numberOfLogs: 1 }))).resolves.toEqual([
      { logId: record.Id, log: 'body', logPath: undefined }
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.stringContaining(record.Id));
  });

  it('passes filenames and bodies to the injected writer and retains its typed failures', async () => {
    const write = vi.fn((name: string, body: string) => Effect.succeed(`/logs/${name}`));
    await expect(
      Effect.runPromise(
        getLogs(makeConnection(vi.fn(), vi.fn().mockResolvedValue('body')), { logId: record.Id }, write)
      )
    ).resolves.toEqual([{ logId: record.Id, log: 'body', logPath: `/logs/${record.Id}.log` }]);
    expect(write).toHaveBeenCalledWith(`${record.Id}.log`, 'body');
    const failure = { _tag: 'WriteFailure', message: 'permission denied' };
    await expect(
      Effect.runPromise(Effect.flip(saveLog(record.Id, 'body', () => Effect.fail(failure))))
    ).resolves.toEqual(failure);
  });

  it('waits for injected writes to complete', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const completed = yield* Deferred.make<string>();
        const writing = yield* saveLog(record.Id, 'body', () => Deferred.await(completed)).pipe(Effect.fork);
        expect(yield* Fiber.poll(writing)).toMatchObject({ _tag: 'None' });
        yield* Deferred.succeed(completed, '/saved.log');
        expect(yield* Fiber.join(writing)).toEqual({ logId: record.Id, log: 'body', logPath: '/saved.log' });
      })
    );
  });

  it('does not write partial results when a body fetch fails', async () => {
    const request = vi.fn().mockResolvedValueOnce('body').mockRejectedValueOnce(new Error('failed'));
    const query = vi.fn().mockResolvedValue({ records: [record, { ...record, Id: '07L000000000002AAA' }] });
    const write = vi.fn(() => Effect.succeed('path'));
    await Effect.runPromise(Effect.flip(getLogs(makeConnection(query, request), { numberOfLogs: 2 }, write)));
    expect(write).not.toHaveBeenCalled();
  });
});

describe('scheduled Apex log discovery', () => {
  it('advances a time/id cursor, follows pages, and retrieves only new bodies', async () => {
    const second = { ...record, Id: '07L000000000002AAA' };
    const third = { ...record, Id: '07L000000000003AAA', StartTime: '2026-10-29T10:00:01.000Z' };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ records: [record], done: false, nextRecordsUrl: '/page2' })
      .mockResolvedValueOnce({ records: [third], done: true });
    const queryMore = vi.fn().mockResolvedValue({ records: [second], done: true });
    const request = vi.fn().mockResolvedValue('body');
    const logs = await streamLogs(
      makeConnection(query, request, queryMore),
      { userId: record.LogUserId },
      Schedule.recurs(1)
    ).pipe(Stream.runCollect, Effect.runPromise);
    expect(Chunk.toReadonlyArray(logs)).toEqual([record, second, third].map(item => ({ record: item, log: 'body' })));
    expect(query.mock.calls[0][0]).toContain('ORDER BY StartTime ASC, Id ASC');
    expect(query.mock.calls[1][0]).toContain(
      `(StartTime > ${record.StartTime} OR (StartTime = ${record.StartTime} AND Id > '${second.Id}'))`
    );
    expect(query.mock.calls[1][0]).toContain(`LogUserId = '${record.LogUserId}'`);
    expect(queryMore).toHaveBeenCalledWith('/page2');
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('resumes from a supplied cursor and does not impose the CLI count cap', async () => {
    const query = vi.fn().mockResolvedValue({
      records: Array.from({ length: 30 }, (_, index) => ({
        ...record,
        Id: `07L${String(index).padStart(12, '0')}AAA`
      }))
    });
    const connection = makeConnection(query, vi.fn().mockResolvedValue('body'));
    const logs = await streamLogs(
      connection,
      { cursor: { startTime: record.StartTime, logId: '07L000000000000AAA' } },
      Schedule.recurs(0)
    ).pipe(Stream.runCollect, Effect.runPromise);
    expect(Chunk.size(logs)).toBe(30);
    expect(query.mock.calls[0][0]).toContain("Id > '07L000000000000AAA'");
    expect(query.mock.calls[0][0]).not.toContain('LIMIT');
  });

  it('keeps the cursor through empty polls and gives each subscription its own cursor', async () => {
    const cursor = { startTime: record.StartTime, logId: record.Id };
    const query = vi.fn().mockResolvedValue({ records: [] });
    const logs = streamLogs(makeConnection(query), { cursor }, Schedule.recurs(1));
    await logs.pipe(Stream.runDrain, Effect.runPromise);
    await logs.pipe(Stream.runDrain, Effect.runPromise);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls.map(([soql]) => soql)).toEqual(Array(4).fill(query.mock.calls[0][0]));
    expect(query.mock.calls[0][0]).toContain(`Id > '${record.Id}'`);
  });

  it('uses the requested schedule and stops polling when interrupted', async () => {
    const query: Mock = vi.fn().mockResolvedValue({ records: [record] });
    await Effect.runPromise(
      Effect.gen(function* () {
        const firstBody = yield* Deferred.make<void>();
        const request = vi.fn().mockImplementation(() => {
          Effect.runSync(Deferred.succeed(firstBody, undefined));
          return Promise.resolve('body');
        });
        const fiber = yield* streamLogs(makeConnection(query, request), {}, Schedule.spaced(Duration.seconds(30))).pipe(
          Stream.runDrain,
          Effect.fork
        );
        yield* Deferred.await(firstBody);
        yield* TestClock.adjust(Duration.seconds(29));
        expect(query).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust(Duration.seconds(1));
        expect(query).toHaveBeenCalledTimes(2);
        yield* Fiber.interrupt(fiber);
        yield* TestClock.adjust(Duration.minutes(1));
        expect(query).toHaveBeenCalledTimes(2);
      }).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it('propagates body errors instead of silently skipping logs', async () => {
    const connection = makeConnection(
      vi.fn().mockResolvedValue({ records: [record] }),
      vi.fn().mockRejectedValue(new Error('body failed'))
    );
    await expect(
      streamLogs(connection, {}, Schedule.recurs(0)).pipe(Stream.runCollect, Effect.flip, Effect.runPromise)
    ).resolves.toMatchObject({ _tag: 'ApexOperationError', operation: 'getLogBody' });
  });
});
