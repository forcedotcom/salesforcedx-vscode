import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
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

const client = () =>
  createSalesforceClient({
    instanceUrl: new URL('https://example.my.salesforce.com'),
    accessToken: 'token'
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
