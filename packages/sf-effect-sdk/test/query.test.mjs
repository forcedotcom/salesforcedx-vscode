import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import promiseAdapter from '../dist/promise.cjs';

const { createSalesforceClient, query } = promiseAdapter;

const originalFetch = globalThis.fetch;
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
  else delete globalThis.location;
});

const jsonResponse = value =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const client = (config = {}) =>
  createSalesforceClient({
    instanceUrl: new URL('https://example.my.salesforce.com'),
    accessToken: 'token',
    apiVersion: '62.0',
    ...config
  });

test('query delegates pagination to sf-effect', async () => {
  const urls = [];
  globalThis.fetch = async input => {
    urls.push(String(input));
    return urls.length === 1
      ? jsonResponse({
          totalSize: 2,
          done: false,
          nextRecordsUrl: '/services/data/v62.0/query/next',
          records: [{ Id: '001' }]
        })
      : jsonResponse({ totalSize: 2, done: true, records: [{ Id: '002' }] });
  };

  const result = await query({ client: await client(), soql: 'SELECT Id FROM Account' }, ['Id']);
  assert.equal(result.totalSize, 2);
  assert.equal(urls.length, 1);
  assert.deepEqual(await Array.fromAsync(result.records), [{ Id: '001' }, { Id: '002' }]);
  assert.deepEqual(urls, [
    'https://example.my.salesforce.com/services/data/v62.0/query?q=SELECT%20Id%20FROM%20Account',
    'https://example.my.salesforce.com/services/data/v62.0/query/next'
  ]);
});

test('query ignores an invalid web extension worker base for absolute Salesforce URLs', async () => {
  globalThis.location = { origin: 'not a valid origin', pathname: '/worker.js' };
  globalThis.fetch = async () => jsonResponse({ totalSize: 0, done: true, records: [] });

  const result = await query({ client: await client(), soql: 'SELECT Id FROM Account' }, ['Id']);
  assert.deepEqual(await Array.fromAsync(result.records), []);
});

test('query accepts a structured query and rejects fields outside the record schema', async () => {
  globalThis.fetch = async () => jsonResponse({ totalSize: 1, done: true, records: [{ Id: '001' }] });
  const salesforceClient = await client();

  const result = await query({ client: salesforceClient, from: 'Account', fields: ['Id'] }, ['Id']);
  assert.equal(result.totalSize, 1);
  assert.deepEqual(await Array.fromAsync(result.records), [{ Id: '001' }]);
  await assert.rejects(
    query({ client: salesforceClient, from: 'Account', fields: ['Missing'] }, ['Id']),
    error => error?._tag === 'SchemaError'
  );
});

test('query preserves sf-effect typed query failures', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ message: 'unexpected token', errorCode: 'MALFORMED_QUERY' }]), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });

  await assert.rejects(
    query({ client: await client(), soql: 'SELECT Id FROM' }, ['Id']),
    error => error?._tag === 'SoqlError' && error.errorCode === 'MALFORMED_QUERY' && error.soql === 'SELECT Id FROM'
  );
});

test('query uses the configured API version and refreshes an expired token on a later page', async () => {
  const requests = [];
  const refreshAccessToken = mock.fn(async () => 'fresh-token');
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
    if (requests.length === 1) {
      return jsonResponse({
        totalSize: 2,
        done: false,
        nextRecordsUrl: '/services/data/v67.0/query/next',
        records: [{ Id: '001' }]
      });
    }
    if (requests.length === 2) {
      return new Response(JSON.stringify([{ message: 'Session expired', errorCode: 'INVALID_SESSION_ID' }]), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }
    return jsonResponse({ totalSize: 2, done: true, records: [{ Id: '002' }] });
  };

  const result = await query(
    {
      client: await client({ apiVersion: '67.0', accessToken: 'stale-token', refreshAccessToken }),
      soql: 'SELECT Id FROM Account'
    },
    ['Id']
  );

  assert.deepEqual(await Array.fromAsync(result.records), [{ Id: '001' }, { Id: '002' }]);
  assert.equal(refreshAccessToken.mock.callCount(), 1);
  assert.deepEqual(requests, [
    {
      url: 'https://example.my.salesforce.com/services/data/v67.0/query?q=SELECT%20Id%20FROM%20Account',
      authorization: 'Bearer stale-token'
    },
    {
      url: 'https://example.my.salesforce.com/services/data/v67.0/query/next',
      authorization: 'Bearer stale-token'
    },
    {
      url: 'https://example.my.salesforce.com/services/data/v67.0/query/next',
      authorization: 'Bearer fresh-token'
    }
  ]);
});
