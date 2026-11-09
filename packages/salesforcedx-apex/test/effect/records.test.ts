/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { queryRecords } from '../../src/effect/records';

const RecordSchema = Schema.Struct({ Name: Schema.String });

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
        record: RecordSchema,
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
