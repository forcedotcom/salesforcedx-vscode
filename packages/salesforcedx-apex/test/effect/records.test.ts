/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { deleteRecord, queryRecords } from '../../src/effect/records';
import { DebugLevelId } from '../../src/effect/schema/salesforceId';
import { RecordSaveResultSchema } from '../../src/effect/schema/wire/records';

const RecordSchema = Schema.Struct({ Name: Schema.String });

describe('RecordSaveResultSchema', () => {
  const saveResultSchema = RecordSaveResultSchema(DebugLevelId);

  it('decodes successful writes with their record ID', () => {
    expect(
      Schema.decodeUnknownSync(saveResultSchema)({
        success: true,
        id: '7dl000000000001',
        errors: []
      })
    ).toEqual({ success: true, id: '7dl000000000001', errors: [] });
  });

  it('decodes failed writes with errors and no record ID', () => {
    expect(
      Schema.decodeUnknownSync(saveResultSchema)({
        success: false,
        errors: [{ message: 'bad field', statusCode: 'INVALID_FIELD' }]
      })
    ).toEqual({ success: false, errors: [{ message: 'bad field', statusCode: 'INVALID_FIELD' }] });
  });

  it.each([
    { success: true, errors: [] },
    { success: false, errors: [] },
    { success: false, id: null, errors: [{ message: 'bad field' }] }
  ])('rejects malformed SaveResult branches: %j', result => {
    expect(Schema.decodeUnknownEither(saveResultSchema)(result)._tag).toBe('Left');
  });
});

describe('deleteRecord', () => {
  it('returns the validated SaveResult instead of discarding its ID', async () => {
    const id = Schema.decodeUnknownSync(DebugLevelId)('7dl000000000001');
    const deleteSpy = vi.fn(async () => ({ success: true as const, id, errors: [] }));
    const connection = { tooling: { delete: deleteSpy } } as unknown as Connection;

    const result = await Effect.runPromise(
      deleteRecord({
        connection,
        operation: 'deleteDebugLevel',
        type: 'DebugLevel',
        recordId: id,
        idSchema: DebugLevelId
      })
    );

    expect(result).toEqual({ success: true, id, errors: [] });
    expect(deleteSpy).toHaveBeenCalledExactlyOnceWith('DebugLevel', id);
  });
});

describe('queryRecords pagination', () => {
  it.each([
    ['REST', false],
    ['Tooling', true]
  ] as const)('follows queryMore for %s queries', async (_name, tooling) => {
    const rest = { query: vi.fn(), queryMore: vi.fn() };
    const toolingApi = { query: vi.fn(), queryMore: vi.fn() };
    const connection = { ...rest, tooling: toolingApi } as unknown as Connection;
    const selectedApi = tooling ? toolingApi : rest;
    const unusedApi = tooling ? rest : toolingApi;
    selectedApi.query.mockResolvedValue({
      done: false,
      nextRecordsUrl: '/next-page',
      totalSize: 2,
      records: [{ Name: 'first' }]
    });
    selectedApi.queryMore.mockResolvedValue({ done: true, totalSize: 2, records: [{ Name: 'second' }] });

    const result = await Effect.runPromise(
      queryRecords({
        connection,
        operation: 'testQuery',
        soql: 'SELECT Name FROM Account',
        recordSchema: RecordSchema,
        tooling
      })
    );

    expect(result).toEqual([{ Name: 'first' }, { Name: 'second' }]);
    expect(selectedApi.query).toHaveBeenCalledExactlyOnceWith('SELECT Name FROM Account');
    expect(selectedApi.queryMore).toHaveBeenCalledExactlyOnceWith('/next-page');
    expect(unusedApi.query).not.toHaveBeenCalled();
    expect(unusedApi.queryMore).not.toHaveBeenCalled();
  });
});
