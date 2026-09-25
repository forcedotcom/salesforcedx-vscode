/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { QueryService } from '../../../src/core/queryService';
import { QueryError } from '../../../src/errors/queryErrors';

const SOQL = 'SELECT Id, Name FROM Account';
const PAGE_2 = '/services/data/v62.0/query/01gAA-2000';

const connectionWith = (pages: Record<string, unknown>) => {
  const request = jest.fn(({ url }: { url: string }) => {
    const body = pages[url];
    return body === undefined ? Promise.reject(new Error(`unexpected ${url}`)) : Promise.resolve(body);
  });
  return {
    connection: {
      request,
      instanceUrl: 'https://x.my.salesforce.com',
      getApiVersion: () => '62.0'
    } as unknown as Connection,
    request
  };
};

const urlFor = (soql: string, tooling = false, scanAll = false) =>
  `https://x.my.salesforce.com/services/data/v62.0/${tooling ? 'tooling/' : ''}${scanAll ? 'queryAll' : 'query'}?q=${encodeURIComponent(soql)}`;

const queryEffect = <A, I>(
  connection: Connection,
  options: { soql: string; tooling?: boolean; scanAll?: boolean; maxFetch?: number },
  schema: Schema.Schema<A, I, never>
) =>
  QueryService.pipe(
    Effect.flatMap(queryService => queryService.query(connection, options, schema)),
    Effect.provide(QueryService.Default)
  );

const run = <A, I>(
  connection: Connection,
  options: { soql: string; tooling?: boolean; scanAll?: boolean; maxFetch?: number },
  schema: Schema.Schema<A, I, never>
) => queryEffect(connection, options, schema).pipe(Effect.runPromise);

const fail = <A, I>(
  connection: Connection,
  options: { soql: string; tooling?: boolean; scanAll?: boolean; maxFetch?: number },
  schema: Schema.Schema<A, I, never>
) => queryEffect(connection, options, schema).pipe(Effect.flip, Effect.runPromise);

const Account = Schema.Struct({ Id: Schema.String, Name: Schema.String });

describe('QueryService.query', () => {
  it('returns the first page only when maxFetch is omitted', async () => {
    const first = urlFor(SOQL);
    const { connection, request } = connectionWith({
      [first]: {
        totalSize: 3,
        done: false,
        nextRecordsUrl: PAGE_2,
        records: [{ Id: '001', Name: 'One', attributes: { type: 'Account' } }]
      }
    });
    const result = await run(connection, { soql: SOQL }, Schema.Unknown);
    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totalSize: 3,
      records: [{ Id: '001', Name: 'One', attributes: { type: 'Account' } }]
    });
  });

  it('stops the record stream at maxFetch and follows nextRecordsUrl', async () => {
    const first = urlFor(SOQL);
    const { connection, request } = connectionWith({
      [first]: {
        totalSize: 3,
        done: false,
        nextRecordsUrl: PAGE_2,
        records: [{ Id: '001', Name: 'One' }]
      },
      [PAGE_2]: {
        totalSize: 3,
        done: true,
        records: [
          { Id: '002', Name: 'Two' },
          { Id: '003', Name: 'Three' }
        ]
      }
    });
    const result = await run(connection, { soql: SOQL, maxFetch: 2 }, Account);
    expect(request).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      totalSize: 3,
      records: [
        { Id: '001', Name: 'One' },
        { Id: '002', Name: 'Two' }
      ]
    });
  });

  it('does not request the next page when the first page already covers maxFetch', async () => {
    const first = urlFor(SOQL);
    const { connection, request } = connectionWith({
      [first]: {
        totalSize: 3,
        done: false,
        nextRecordsUrl: PAGE_2,
        records: [
          { Id: '001', Name: 'One' },
          { Id: '002', Name: 'Two' },
          { Id: '003', Name: 'Three' }
        ]
      }
    });
    const result = await run(connection, { soql: SOQL, maxFetch: 2 }, Account);
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.records).toEqual([
      { Id: '001', Name: 'One' },
      { Id: '002', Name: 'Two' }
    ]);
  });

  it('sends queryAll when scanAll is set and tooling/query when tooling is set', async () => {
    const scanAllUrl = urlFor(SOQL, false, true);
    const toolingUrl = urlFor(SOQL, true, false);
    const { connection, request } = connectionWith({
      [scanAllUrl]: { totalSize: 0, done: true, records: [] },
      [toolingUrl]: { totalSize: 0, done: true, records: [] }
    });
    await run(connection, { soql: SOQL, scanAll: true }, Schema.Unknown);
    await run(connection, { soql: SOQL, tooling: true }, Schema.Unknown);
    expect(request).toHaveBeenNthCalledWith(1, { method: 'GET', url: scanAllUrl });
    expect(request).toHaveBeenNthCalledWith(2, { method: 'GET', url: toolingUrl });
  });

  it('keeps attributes and child relationships for Schema.Unknown and strips them for a Struct', async () => {
    const first = urlFor(SOQL);
    const record = {
      Id: '001',
      Name: 'One',
      attributes: { type: 'Account' },
      Contacts: { totalSize: 1, done: true, records: [{ Name: 'Pat' }] }
    };
    const { connection } = connectionWith({
      [first]: { totalSize: 1, done: true, records: [record] }
    });
    const passthrough = await run(connection, { soql: SOQL }, Schema.Unknown);
    const stripped = await run(connection, { soql: SOQL }, Account);
    expect(passthrough.records).toEqual([record]);
    expect(stripped.records).toEqual([{ Id: '001', Name: 'One' }]);
  });

  it('returns a totals-only envelope when records is absent', async () => {
    const first = urlFor('SELECT COUNT() FROM Account');
    const { connection, request } = connectionWith({
      [first]: { totalSize: 14, done: true }
    });
    const result = await run(connection, { soql: 'SELECT COUNT() FROM Account' }, Schema.Unknown);
    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ totalSize: 14 });
    expect(result).not.toHaveProperty('records');
  });

  it('follows child nextRecordsUrl when maxFetch is set', async () => {
    const first = urlFor(SOQL);
    const childUrl = '/services/data/v62.0/query/child-1';
    const { connection, request } = connectionWith({
      [first]: {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: '001',
            Name: 'One',
            Contacts: {
              totalSize: 2,
              done: false,
              nextRecordsUrl: childUrl,
              records: [{ Name: 'Pat' }]
            }
          }
        ]
      },
      [childUrl]: { totalSize: 2, done: true, records: [{ Name: 'Sam' }] }
    });
    const result = await run(connection, { soql: SOQL, maxFetch: 10 }, Schema.Unknown);
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.records).toEqual([
      {
        Id: '001',
        Name: 'One',
        Contacts: { totalSize: 2, done: true, records: [{ Name: 'Pat' }, { Name: 'Sam' }] }
      }
    ]);
  });

  it('fails with QueryError when the request rejects', async () => {
    const { connection } = connectionWith({});
    const error = await fail(connection, { soql: SOQL }, Schema.Unknown);
    expect(error).toBeInstanceOf(QueryError);
    expect(error).toMatchObject({ message: expect.stringContaining('unexpected'), _tag: 'QueryError' });
  });

  it('copies errorCode from a rejected request', async () => {
    const request = jest.fn(() => Promise.reject({ message: 'unexpected token', errorCode: 'MALFORMED_QUERY' }));
    const connection = {
      request,
      instanceUrl: 'https://x.my.salesforce.com',
      getApiVersion: () => '62.0'
    } as unknown as Connection;
    const error = await fail(connection, { soql: SOQL }, Schema.Unknown);
    expect(error).toMatchObject({ errorCode: 'MALFORMED_QUERY', message: 'unexpected token' });
  });
});
