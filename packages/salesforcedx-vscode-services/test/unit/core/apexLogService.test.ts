/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ApexLogService } from '../../../src/core/apexLogService';
import { ConnectionService } from '../../../src/core/connectionService';

const record = {
  Id: '07L000000000001AAA',
  Application: 'Unknown',
  DurationMilliseconds: 12,
  Location: 'SystemLog',
  Request: 'API',
  LogLength: 120,
  LogUserId: '005000000000001AAA',
  LogUser: { Name: 'Test User', attributes: { type: 'User' } },
  Operation: 'executeAnonymous',
  StartTime: '2026-10-29T10:00:00.000Z',
  Status: 'Success'
};

const withConnection = (connection: Connection) =>
  ApexLogService.DefaultWithoutDependencies.pipe(
    Layer.provide(
      Layer.succeed(
        ConnectionService,
        ConnectionService.make({
          getConnection: () => Effect.succeed(connection)
        } as never)
      )
    )
  );

describe('ApexLogService adapter', () => {
  it('retains the services projection while the library queries the full record', async () => {
    const query = vi.fn().mockResolvedValue({ records: [record], done: true });
    const connection = { tooling: { query } } as unknown as Connection;
    const result = await ApexLogService.listLogs(2, { userId: record.LogUserId }).pipe(
      Effect.provide(withConnection(connection)),
      Effect.runPromise
    );
    expect(result).toEqual([
      {
        Id: record.Id,
        Application: record.Application,
        DurationMilliseconds: record.DurationMilliseconds,
        LogLength: record.LogLength,
        LogUserId: record.LogUserId,
        LogUser: { Name: record.LogUser.Name },
        Operation: record.Operation,
        StartTime: record.StartTime,
        Status: record.Status
      }
    ]);
    expect(result[0]).not.toHaveProperty('Location');
    expect(result[0]).not.toHaveProperty('Request');
    expect(query).toHaveBeenCalledWith(expect.stringContaining(`WHERE LogUserId = '${record.LogUserId}'`));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 2'));
  });

  it('keeps nullable optional fields absent', async () => {
    const query = vi.fn().mockResolvedValue({ records: [{ ...record, Application: null, LogUser: null }] });
    const connection = { tooling: { query } } as unknown as Connection;
    const result = await ApexLogService.listLogs().pipe(Effect.provide(withConnection(connection)), Effect.runPromise);
    expect(result[0].Application).toBeUndefined();
    expect(result[0].LogUser).toBeUndefined();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 25'));
  });

  it('preserves explicit limits above the CLI cap', async () => {
    const query = vi.fn().mockResolvedValue({ records: [] });
    const connection = { tooling: { query } } as unknown as Connection;
    await ApexLogService.listLogs(100).pipe(Effect.provide(withConnection(connection)), Effect.runPromise);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 100'));
  });

  it('preserves the body error tag and message', async () => {
    const connection = {
      tooling: {
        _baseUrl: () => 'https://example.com/tooling',
        request: vi.fn().mockRejectedValue(new Error('not found'))
      }
    } as unknown as Connection;
    await expect(
      ApexLogService.getLogBody(record.Id).pipe(
        Effect.flip,
        Effect.provide(withConnection(connection)),
        Effect.runPromise
      )
    ).resolves.toMatchObject({ _tag: 'ApexLogBodyFetchError', message: 'Failed to fetch ApexLog body: not found' });
  });
});
