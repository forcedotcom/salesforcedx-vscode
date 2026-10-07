/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ParseResult from 'effect/ParseResult';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ConnectionService } from '../../../src/core/connectionService';
import { QueryService } from '../../../src/core/queryService';
import { FieldError, SoqlError } from '../../../src/errors/queryErrors';

const SOQL = 'SELECT Id, Name FROM Account';
const PAGE_2 = '/services/data/v62.0/query/01gAA-2000';

const connectionWith = (pages: {
  readonly query?: (soql: string, options?: { scanAll?: boolean }) => Promise<unknown>;
  readonly queryMore?: (locator: string) => Promise<unknown>;
  readonly toolingQuery?: (soql: string, options?: { scanAll?: boolean }) => Promise<unknown>;
  readonly toolingQueryMore?: (locator: string) => Promise<unknown>;
}) =>
  ({
    query: pages.query ?? (() => Promise.reject(new Error('unexpected query'))),
    queryMore: pages.queryMore ?? (() => Promise.reject(new Error('unexpected queryMore'))),
    tooling: {
      query: pages.toolingQuery ?? (() => Promise.reject(new Error('unexpected tooling.query'))),
      queryMore: pages.toolingQueryMore ?? (() => Promise.reject(new Error('unexpected tooling.queryMore')))
    }
  }) as unknown as Connection;

const withConnection = (connection: Connection) => {
  const connectionLayer = Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: () => Effect.succeed(connection),
      getConnectionForOrg: () => Effect.succeed(connection),
      validateAccessTokenOrPromptReauth: () => Effect.void,
      invalidateCachedConnections: () => Effect.void,
      listAllAuthorizations: () => Effect.succeed([])
    } as never)
  );
  const queryLayer = QueryService.DefaultWithoutDependencies.pipe(Layer.provide(connectionLayer));
  return Layer.merge(connectionLayer, queryLayer);
};

const collect = <A, I>(
  connection: Connection,
  options: Parameters<InstanceType<typeof QueryService>['query']>[0],
  schema: Schema.Schema<A, I, never>
) =>
  QueryService.pipe(
    Effect.flatMap(queryService => queryService.query(options, schema)),
    Effect.flatMap(({ totalSize, records }) =>
      Stream.runCollect(records).pipe(Effect.map(chunk => ({ totalSize, records: Chunk.toReadonlyArray(chunk) })))
    ),
    Effect.provide(withConnection(connection)),
    Effect.runPromise
  );

const fail = <A, I>(
  connection: Connection,
  options: { soql: string; tooling?: boolean; scanAll?: boolean },
  schema: Schema.Schema<A, I, never>
) =>
  QueryService.pipe(
    Effect.flatMap(queryService => queryService.query(options, schema)),
    Effect.flatMap(({ records }) => Stream.runCollect(records)),
    Effect.flip,
    Effect.provide(withConnection(connection)),
    Effect.runPromise
  );

const Account = Schema.Struct({ Id: Schema.String, Name: Schema.String });

describe('QueryService.query', () => {
  it('paginates until done and keeps page-1 totalSize', async () => {
    const query = vi.fn(() =>
      Promise.resolve({
        totalSize: 3,
        done: false,
        nextRecordsUrl: PAGE_2,
        records: [{ Id: '001', Name: 'One', attributes: { type: 'Account' } }]
      })
    );
    const queryMore = vi.fn(() =>
      Promise.resolve({
        totalSize: 3,
        done: true,
        records: [{ Id: '002', Name: 'Two', attributes: { type: 'Account' } }]
      })
    );
    const result = await collect(connectionWith({ query, queryMore }), { soql: SOQL }, Schema.Unknown);
    expect(query).toHaveBeenCalledWith(SOQL, { scanAll: false });
    expect(queryMore).toHaveBeenCalledWith(PAGE_2);
    expect(result).toEqual({
      totalSize: 3,
      records: [
        { Id: '001', Name: 'One', attributes: { type: 'Account' } },
        { Id: '002', Name: 'Two', attributes: { type: 'Account' } }
      ]
    });
  });

  it('stops at Stream.take without requesting another page when the first page is enough', async () => {
    const query = vi.fn(() =>
      Promise.resolve({
        totalSize: 3,
        done: false,
        nextRecordsUrl: PAGE_2,
        records: [
          { Id: '001', Name: 'One' },
          { Id: '002', Name: 'Two' },
          { Id: '003', Name: 'Three' }
        ]
      })
    );
    const queryMore = vi.fn();
    const connection = connectionWith({ query, queryMore });
    const taken = await QueryService.pipe(
      Effect.flatMap(queryService => queryService.query({ soql: SOQL }, Account)),
      Effect.flatMap(({ totalSize, records }) =>
        Stream.take(records, 2).pipe(
          Stream.runCollect,
          Effect.map(chunk => ({ totalSize, records: Chunk.toReadonlyArray(chunk) }))
        )
      ),
      Effect.provide(withConnection(connection)),
      Effect.runPromise
    );
    expect(queryMore).not.toHaveBeenCalled();
    expect(taken).toEqual({
      totalSize: 3,
      records: [
        { Id: '001', Name: 'One' },
        { Id: '002', Name: 'Two' }
      ]
    });
  });

  it('uses tooling.query when tooling is set and queryAll via scanAll', async () => {
    const toolingQuery = vi.fn(() => Promise.resolve({ totalSize: 0, done: true, records: [] }));
    const query = vi.fn(() => Promise.resolve({ totalSize: 0, done: true, records: [] }));
    await collect(connectionWith({ toolingQuery }), { soql: SOQL, tooling: true }, Schema.Unknown);
    await collect(connectionWith({ query }), { soql: SOQL, scanAll: true }, Schema.Unknown);
    expect(toolingQuery).toHaveBeenCalledWith(SOQL, { scanAll: false });
    expect(query).toHaveBeenCalledWith(SOQL, { scanAll: true });
  });

  it('keeps attributes for Schema.Unknown and strips them for a Struct', async () => {
    const record = {
      Id: '001',
      Name: 'One',
      attributes: { type: 'Account' },
      Contacts: { totalSize: 1, done: true, records: [{ Name: 'Pat' }] }
    };
    const query = vi.fn(() => Promise.resolve({ totalSize: 1, done: true, records: [record] }));
    const connection = connectionWith({ query });
    const passthrough = await collect(connection, { soql: SOQL }, Schema.Unknown);
    const stripped = await collect(connection, { soql: SOQL }, Account);
    expect(passthrough.records).toEqual([record]);
    expect(stripped.records).toEqual([{ Id: '001', Name: 'One' }]);
  });

  it('returns an empty records stream when the envelope has no records', async () => {
    const query = vi.fn(() => Promise.resolve({ totalSize: 14, done: true }));
    const result = await collect(connectionWith({ query }), { soql: 'SELECT COUNT() FROM Account' }, Schema.Unknown);
    expect(result).toEqual({ totalSize: 14, records: [] });
  });

  it('fails with SoqlError when the org rejects the statement', async () => {
    const query = vi.fn(() =>
      Promise.reject({ message: 'unexpected token', errorCode: 'MALFORMED_QUERY', statusCode: 400 })
    );
    const error = await fail(connectionWith({ query }), { soql: SOQL }, Schema.Unknown);
    expect(error).toBeInstanceOf(SoqlError);
    expect(error).toMatchObject({
      _tag: 'SoqlError',
      errorCode: 'MALFORMED_QUERY',
      soql: SOQL,
      statusCode: 400,
      message: 'unexpected token'
    });
  });

  it('fails with FieldError when INVALID_FIELD names fields', async () => {
    const query = vi.fn(() =>
      Promise.reject({
        message: 'No such column',
        errorCode: 'INVALID_FIELD',
        statusCode: 400,
        fields: ['Bogus__c']
      })
    );
    const error = await fail(connectionWith({ query }), { soql: SOQL }, Schema.Unknown);
    expect(error).toBeInstanceOf(FieldError);
    expect(error).toMatchObject({
      _tag: 'FieldError',
      errorCode: 'INVALID_FIELD',
      fields: ['Bogus__c'],
      soql: SOQL
    });
  });

  it('fails with a parse error when a record does not match the schema', async () => {
    const query = vi.fn(() => Promise.resolve({ totalSize: 1, done: true, records: [{ Id: 1, Name: 'One' }] }));
    const error = await fail(connectionWith({ query }), { soql: SOQL }, Account);
    expect(ParseResult.isParseError(error)).toBe(true);
  });
});
