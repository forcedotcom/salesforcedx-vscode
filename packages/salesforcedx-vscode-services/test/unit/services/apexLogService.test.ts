/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import {
  ApexLogListItem,
  ApexLogService,
  ConnectionService,
  NoWorkspaceOpenError,
  QueryService,
  type QueryOptions
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ApexLogServiceLayer } from '../../../src/services/apexLogService.js';

const required = { Id: '07L000000000001', LogLength: 123, StartTime: '2026-11-02T00:00:00.000Z', Status: 'Success' };
const decode = Schema.decodeUnknownSync(ApexLogListItem);
it('preserves required fields and optional null/undefined/missing decoding exactly', () => {
  expect(decode(required)).toEqual(required);
  expect(decode({ ...required, Application: null, LogUser: null, DurationMilliseconds: null })).toEqual(required);
  expect(decode({ ...required, Application: undefined })).toEqual({ ...required, Application: undefined });
  expect(Object.hasOwn(decode({ ...required, Application: undefined }), 'Application')).toBe(true);
  expect(decode({ ...required, LogUser: { Name: null } })).toEqual({ ...required, LogUser: {} });
  expect(Object.hasOwn(decode(required), 'Application')).toBe(false);
  expect(Object.hasOwn(decode({ ...required, Application: null }), 'Application')).toBe(false);
  expect(Object.hasOwn(decode({ ...required, LogUser: { Name: null } }).LogUser ?? {}, 'Name')).toBe(false);
  expect(decode({ ...required, LogUser: { Name: 'User' }, DurationMilliseconds: 0, Application: '' })).toEqual({
    ...required,
    LogUser: { Name: 'User' },
    DurationMilliseconds: 0,
    Application: ''
  });
});
it.each(['Id', 'LogLength', 'StartTime', 'Status'] as const)(
  'rejects missing/null required %s without loosening the wire schema',
  field => {
    expect(() => decode({ ...required, [field]: undefined })).toThrow();
    expect(() => decode({ ...required, [field]: null })).toThrow();
  }
);
it('does not coerce malformed numbers or optional relationships', () => {
  expect(() => decode({ ...required, DurationMilliseconds: '5' })).toThrow();
  expect(() => decode({ ...required, LogUser: 'User' })).toThrow();
});

const queries: QueryOptions[] = [];
let pages: readonly unknown[][];
let connectionFails: boolean;
let laterPageWait: Promise<void> | undefined;
let laterPageStarted: (() => void) | undefined;
const request = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const connection = {
  instanceUrl: 'https://fixture.example',
  getApiVersion: () => '68.0',
  request
} as unknown as Connection;
const query: QueryService['Service']['query'] = (options, decodePage) => {
  queries.push(options);
  return decodePage({ totalSize: pages.flat().length, records: pages[0], done: pages.length === 1 }).pipe(
    Effect.map(first => ({
      totalSize: first.totalSize,
      records: Stream.fromIterable(first.records ?? []).pipe(
        Stream.concat(
          Stream.fromIterable(pages.slice(1)).pipe(
            Stream.flatMap(records =>
              Stream.unwrap(
                Effect.sync(() => laterPageStarted?.()).pipe(
                  Effect.andThen(Effect.promise(() => laterPageWait ?? Promise.resolve())),
                  Effect.andThen(decodePage({ totalSize: pages.flat().length, records })),
                  Effect.map(page => Stream.fromIterable(page.records ?? []))
                )
              )
            )
          )
        )
      )
    }))
  );
};
const makeRuntime = () =>
  ManagedRuntime.make(
    ApexLogServiceLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.mock(QueryService, { query }),
          Layer.mock(ConnectionService, {
            getConnection: () =>
              connectionFails
                ? Effect.fail(new NoWorkspaceOpenError({ message: 'no workspace' }))
                : Effect.succeed(connection)
          })
        )
      )
    )
  );
beforeEach(() => {
  queries.splice(0);
  pages = [[required]];
  connectionFails = false;
  laterPageWait = undefined;
  laterPageStarted = undefined;
  request.mockResolvedValue('log body');
});

it('queries tooling logs with the default limit and preserves page order', async () => {
  pages = [[required], [{ ...required, Id: '07L000000000002' }]];
  const runtime = makeRuntime();
  try {
    expect(await runtime.runPromise(ApexLogService.use(service => service.listLogs()))).toEqual([
      required,
      { ...required, Id: '07L000000000002' }
    ]);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.tooling).toBe(true);
    expect(queries[0]?.soql).toBe(
      'SELECT Id, Application, DurationMilliseconds, LogLength, LogUserId, LogUser.Name, Operation, StartTime, Status FROM ApexLog ORDER BY StartTime DESC LIMIT 25'
    );
  } finally {
    await runtime.dispose();
  }
});
it('preserves filter escaping, multi-user precedence, date syntax and custom limit', async () => {
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(
      ApexLogService.use(service =>
        service.listLogs(50, {
          userId: 'ignored',
          userIds: ['first', "second'user"],
          operationContains: "execute'Anonymous",
          startTimeAfter: '2026-11-02T00:00:00Z'
        })
      )
    );
    expect(queries[0]?.soql).toContain(
      "WHERE LogUserId IN ('first','second''user') AND Operation LIKE '%execute''Anonymous%' AND StartTime >= 2026-11-02T00:00:00Z ORDER BY StartTime DESC LIMIT 50"
    );
    await runtime.runPromise(ApexLogService.use(service => service.listLogs(5, { userId: "one'user", userIds: [] })));
    expect(queries[1]?.soql).toContain("WHERE LogUserId = 'one''user'");
  } finally {
    await runtime.dispose();
  }
});
it('validates later query pages rather than returning malformed records', async () => {
  pages = [[required], [{ ...required, LogLength: 'bad' }]];
  const runtime = makeRuntime();
  try {
    expect(await runtime.runPromise(ApexLogService.use(service => service.listLogs()).pipe(Effect.flip))).toMatchObject(
      { _tag: 'SchemaError' }
    );
  } finally {
    await runtime.dispose();
  }
});
it.each(['log text', 123, null])(
  'uses the native connection/version/body URL and preserves body conversion: %s',
  async response => {
    request.mockResolvedValueOnce(response);
    const runtime = makeRuntime();
    try {
      expect(await runtime.runPromise(ApexLogService.use(service => service.getLogBody(required.Id)))).toBe(
        String(response)
      );
      expect(request).toHaveBeenCalledExactlyOnceWith({
        method: 'GET',
        url: `https://fixture.example/services/data/v68.0/tooling/sobjects/ApexLog/${required.Id}/Body`
      });
    } finally {
      await runtime.dispose();
    }
  }
);
it('retains a native body failure cause and preserves connection failures', async () => {
  const cause = new Error('request failed');
  request.mockRejectedValueOnce(cause);
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(ApexLogService);
    expect(await runtime.runPromise(service.getLogBody(required.Id).pipe(Effect.flip))).toMatchObject({
      _tag: 'ApexLogBodyFetchError',
      message: 'Failed to fetch ApexLog body: request failed',
      cause
    });
    connectionFails = true;
    expect(await runtime.runPromise(service.getLogBody(required.Id).pipe(Effect.flip))).toMatchObject({
      _tag: 'NoWorkspaceOpenError'
    });
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});
it('rejects lazy public calls after owner shutdown without starting query or HTTP work', async () => {
  const runtime = makeRuntime();
  const service = await runtime.runPromise(ApexLogService);
  const logs = service.listLogs();
  const body = service.getLogBody(required.Id);
  await runtime.dispose();
  expect(Exit.isFailure(await Effect.runPromiseExit(logs))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(body))).toBe(true);
  expect(queries).toEqual([]);
  expect(request).not.toHaveBeenCalled();
});

it.each(['body', 'later-page'] as const)('interrupts pending %s work during owner shutdown', async method => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const runtime = makeRuntime();
  const service = await runtime.runPromise(ApexLogService);
  if (method === 'body')
    request.mockImplementationOnce(() => {
      started.resolve();
      return release.promise.then(() => 'late log');
    });
  else {
    pages = [[required], [required]];
    laterPageWait = release.promise;
    laterPageStarted = started.resolve;
  }
  const running =
    method === 'body'
      ? Effect.runPromiseExit(service.getLogBody(required.Id).pipe(Effect.asVoid))
      : Effect.runPromiseExit(service.listLogs().pipe(Effect.asVoid));
  await started.promise;
  try {
    await runtime.dispose();
    const exit = await running;
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') expect(exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});
