/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import {
  createSalesforceClient,
  query as sdkQuery,
  restRequest as sdkRestRequest
} from '@salesforce/sf-effect-sdk/promise';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ConnectionService } from '../../../src/core/connectionService';
import { QueryService } from '../../../src/core/queryService';

jest.mock('@salesforce/sf-effect-sdk/promise', () => ({
  createSalesforceClient: jest.fn(),
  query: jest.fn(),
  restRequest: jest.fn()
}));

const mockClient = {};
const mockCreateSalesforceClient = jest.mocked(createSalesforceClient);
const mockSdkQuery = jest.mocked(sdkQuery);
const mockSdkRestRequest = jest.mocked(sdkRestRequest);
const asyncRecords = (...values: unknown[]) =>
  (async function* () {
    yield* values;
  })();

const RecordSchema = Schema.Struct({ Id: Schema.String, Name: Schema.String });

describe('QueryService', () => {
  const makeHarness = () => {
    const connection = {
      instanceUrl: 'https://example.my.salesforce.com',
      accessToken: 'token'
    } as Connection;
    const getConnection = jest.fn(() => Effect.succeed(connection));
    const getConnectionForOrg = jest.fn(() => Effect.succeed(connection));
    const connectionLayer = Layer.succeed(ConnectionService, {
      getConnection,
      getConnectionForOrg
    } as unknown as InstanceType<typeof ConnectionService>);
    const layer = QueryService.DefaultWithoutDependencies.pipe(Layer.provide(connectionLayer));
    const run = <A, E>(effect: Effect.Effect<A, E, QueryService>) =>
      Effect.runPromise(effect.pipe(Effect.provide(layer)));
    return { getConnection, getConnectionForOrg, run };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSalesforceClient.mockResolvedValue(mockClient);
  });

  it('delegates raw SOQL to sf-effect and schema-decodes its records', async () => {
    const harness = makeHarness();
    mockSdkQuery.mockResolvedValue({
      totalSize: 2,
      records: asyncRecords({ Id: '001', Name: 'One' }, { Id: '002', Name: 'Two' })
    });

    const result = await harness.run(
      Effect.gen(function* () {
        const queryService = yield* QueryService;
        const queried = yield* queryService.query({ soql: 'SELECT Id, Name FROM Account' }, RecordSchema);
        return { totalSize: queried.totalSize, records: Array.from(yield* Stream.runCollect(queried.records)) };
      })
    );

    expect(result).toEqual({
      totalSize: 2,
      records: [
        { Id: '001', Name: 'One' },
        { Id: '002', Name: 'Two' }
      ]
    });
    expect(mockSdkQuery).toHaveBeenCalledWith(
      {
        client: mockClient,
        soql: 'SELECT Id, Name FROM Account',
        tooling: undefined,
        scanAll: undefined
      },
      ['Id', 'Name']
    );
  });

  it('passes Tooling and queryAll selection to sf-effect', async () => {
    const harness = makeHarness();
    mockSdkQuery.mockResolvedValue({ totalSize: 0, records: asyncRecords() });

    await harness.run(
      Effect.gen(function* () {
        const queryService = yield* QueryService;
        yield* queryService.query(
          { soql: 'SELECT Id, Name FROM ApexClass', tooling: true, scanAll: true },
          RecordSchema
        );
      })
    );

    expect(mockSdkQuery).toHaveBeenCalledWith(
      {
        client: mockClient,
        soql: 'SELECT Id, Name FROM ApexClass',
        tooling: true,
        scanAll: true
      },
      ['Id', 'Name']
    );
  });

  it('passes structured queries and nested record field paths to sf-effect', async () => {
    const harness = makeHarness();
    const AccountSchema = Schema.Struct({
      Id: Schema.String,
      Owner: Schema.Struct({ Name: Schema.String })
    });
    mockSdkQuery.mockResolvedValue({ totalSize: 1, records: asyncRecords({ Id: '001', Owner: { Name: 'Ada' } }) });

    await harness.run(
      Effect.gen(function* () {
        const queryService = yield* QueryService;
        yield* queryService.query(
          { from: 'Account', fields: ['Id', 'Owner.Name'], orderBy: [{ field: 'Id', direction: 'ascending' }] },
          AccountSchema
        );
      })
    );

    expect(mockSdkQuery).toHaveBeenCalledWith(
      {
        client: mockClient,
        from: 'Account',
        fields: ['Id', 'Owner.Name'],
        where: undefined,
        orderBy: [{ field: 'Id', direction: 'ascending' }],
        limit: undefined,
        offset: undefined,
        tooling: undefined,
        scanAll: undefined
      },
      ['Id', 'Owner', 'Owner.Name']
    );
  });

  it('fetches every relationship subquery page through sf-effect', async () => {
    const harness = makeHarness();
    const AccountSchema = Schema.Struct({
      Id: Schema.String,
      Contacts: Schema.Struct({
        totalSize: Schema.Number,
        done: Schema.Boolean,
        nextRecordsUrl: Schema.optional(Schema.String),
        records: Schema.Array(Schema.Struct({ Id: Schema.String }))
      })
    });
    mockSdkQuery.mockResolvedValue({
      totalSize: 1,
      records: asyncRecords({
        Id: '001',
        Contacts: {
          totalSize: 2,
          done: false,
          nextRecordsUrl: '/services/data/v62.0/query/relationship/next',
          records: [{ Id: '003' }]
        }
      })
    });
    mockSdkRestRequest.mockResolvedValue({
      totalSize: 2,
      done: true,
      records: [{ Id: '004' }]
    });

    const records = await harness.run(
      Effect.gen(function* () {
        const queryService = yield* QueryService;
        const result = yield* queryService.query(
          { soql: 'SELECT Id, (SELECT Id FROM Contacts) FROM Account' },
          AccountSchema
        );
        return Array.from(yield* Stream.runCollect(result.records));
      })
    );

    expect(records[0]?.Contacts).toMatchObject({
      totalSize: 2,
      done: true,
      records: [{ Id: '003' }, { Id: '004' }]
    });
    expect(mockSdkRestRequest).toHaveBeenCalledWith({
      client: mockClient,
      method: 'GET',
      path: '/services/data/v62.0/query/relationship/next'
    });
  });

  it('gets the connection for orgId when supplied', async () => {
    const harness = makeHarness();
    mockSdkQuery.mockResolvedValue({ totalSize: 0, records: asyncRecords() });

    await harness.run(
      Effect.gen(function* () {
        const queryService = yield* QueryService;
        yield* queryService.query({ soql: 'SELECT Id FROM Account', orgId: '00D123' }, RecordSchema);
      })
    );

    expect(harness.getConnectionForOrg).toHaveBeenCalledWith('00D123');
    expect(harness.getConnection).not.toHaveBeenCalled();
  });

  it('preserves sf-effect query failures', async () => {
    const harness = makeHarness();
    const sdkError = Object.assign(new Error('unexpected token: FROM'), {
      _tag: 'SoqlError',
      errorCode: 'MALFORMED_QUERY',
      statusCode: 400,
      soql: 'SELECT Id FROM'
    });
    mockSdkQuery.mockRejectedValue(sdkError);

    const error = await harness.run(
      Effect.gen(function* () {
        const queryService = yield* QueryService;
        return yield* queryService.query({ soql: 'SELECT Id FROM' }, RecordSchema);
      }).pipe(Effect.flip)
    );

    expect(error).toMatchObject({
      _tag: 'SoqlError',
      errorCode: 'MALFORMED_QUERY',
      statusCode: 400,
      soql: 'SELECT Id FROM'
    });
  });

  it('fails with QueryDecodeError when a returned record does not match the Effect 3 schema', async () => {
    const harness = makeHarness();
    mockSdkQuery.mockResolvedValue({ totalSize: 1, records: asyncRecords({ Id: '001', Name: 1 }) });

    const error = await harness.run(
      Effect.gen(function* () {
        const queryService = yield* QueryService;
        const result = yield* queryService.query({ soql: 'SELECT Id, Name FROM Account' }, RecordSchema);
        return yield* Stream.runCollect(result.records);
      }).pipe(Effect.flip)
    );

    expect(error).toMatchObject({ _tag: 'QueryDecodeError' });
  });
});
