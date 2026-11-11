/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { commonConfigBrowser } from '../../../scripts/bundling/web.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempParent = join(packageRoot, 'temp');
mkdirSync(tempParent, { recursive: true });
const consumerRoot = mkdtempSync(join(tempParent, 'packed-web-consumer-'));

try {
  const packResult = JSON.parse(
    execFileSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['pack', '--json', '--pack-destination', consumerRoot],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        env: { ...process.env, npm_config_cache: join(consumerRoot, '.npm-cache') }
      }
    )
  );
  const tarballPath = join(consumerRoot, packResult[0].filename);
  const installedPackage = join(consumerRoot, 'node_modules', '@salesforce', 'apex-node');
  mkdirSync(installedPackage, { recursive: true });
  execFileSync('tar', ['-xzf', tarballPath, '--strip-components=1', '-C', installedPackage]);

  const effectEntry = join(consumerRoot, 'effect-consumer.mjs');
  writeFileSync(
    effectEntry,
    `import * as apexEffectApi from '@salesforce/apex-node/effect';
    import * as Effect from 'effect/Effect';
    import * as Schema from 'effect/Schema';
    globalThis.apexEffectApi = {
      ...apexEffectApi,
      run: (connection, options) => apexEffectApi.runTestSynchronous(connection, options).pipe(Effect.either, Effect.runPromise),
      runTooling: (operation, ...args) => apexEffectApi[operation](...args).pipe(Effect.either, Effect.runPromise),
      notify: callback => Effect.sync(callback),
      decodeSyncResult: Schema.decodeUnknownSync(apexEffectApi.SyncTestResultSchema, { onExcessProperty: 'error' }),
      decodeResult: Schema.decodeUnknownSync(apexEffectApi.TestResultSchema)
    };
    `
  );
  const effectBundle = await build({
    entryPoints: [effectEntry],
    bundle: true,
    conditions: ['import', 'module', 'default'],
    format: 'iife',
    platform: 'browser',
    write: false
  });

  // Run the packed Effect API without process, Buffer, require, or a VS Code host.
  const browser = { AbortController, Error, URL, TextEncoder, TextDecoder, setTimeout, clearTimeout };
  runInNewContext(effectBundle.outputFiles[0].text, browser);
  const api = browser.apexEffectApi;
  const method = {
    id: '01pxx00000NWwb3AAD',
    methodName: 'testOne',
    name: 'TestSample',
    namespace: null,
    seeAllData: false,
    time: 12
  };
  const response = {
    apexLogId: '07Lxx00000cxy6YUAQ',
    numFailures: 1,
    numTestsRun: 3,
    totalTime: 30,
    successes: [method, { ...method, namespace: 'FlowTesting.MyFlow' }],
    failures: [
      {
        ...method,
        namespace: 'pkg',
        message: 'Assertion failed',
        stackTrace: 'Class.TestSample.testOne: line 27, column 1',
        type: 'Class'
      }
    ]
  };
  assert.deepEqual(JSON.parse(JSON.stringify(api.decodeSyncResult(response))), response);
  const requests = [];
  const connection = {
    instanceUrl: 'https://example.my.salesforce.com',
    getAuthInfoFields: () => ({ orgId: '00Dxx0000000001' }),
    getUsername: () => 'test@example.com',
    getConnectionOptions: () => ({ userId: '005xx0000000001' }),
    tooling: {
      _baseUrl: () => 'https://example.my.salesforce.com/services/data/v65.0/tooling',
      request: async request => {
        requests.push(request);
        return response;
      }
    }
  };
  const options = { tests: [{ className: 'TestSample' }], testLevel: 'RunSpecifiedTests' };
  const execution = await api.run(connection, options);
  assert.equal(execution._tag, 'Right');
  const result = JSON.parse(JSON.stringify(execution.right));
  assert.equal(result.summary.outcome, 'Failed');
  assert.equal(result.summary.passRate, '67%');
  assert.equal(result.summary.failRate, '33%');
  assert.equal(result.summary.testExecutionTimeInMs, 30);
  assert.equal(result.tests[0].fullName, 'TestSample.testOne');
  assert.equal(result.tests[1].category, 'Flow');
  assert.equal(result.tests[2].fullName, 'pkg__TestSample.testOne');
  assert.equal(result.tests[2].diagnostic.lineNumber, 27);
  assert.equal(result.tests[2].diagnostic.columnNumber, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url, `${connection.tooling._baseUrl()}/runTestsSynchronous`);
  assert.deepEqual(JSON.parse(requests[0].body), options);
  assert.deepEqual(JSON.parse(JSON.stringify(api.decodeResult(result))), result);

  const normalized = api.transformTestResult({
    ...result,
    summary: { ...result.summary, testSetupTimeInMs: 12 },
    tests: result.tests.map((test, index) => ({ ...test, isTestSetup: index === 0 }))
  });
  assert.equal(normalized.tests.length, 2);
  assert.equal(normalized.setup.length, 1);
  assert.equal(normalized.setup[0].testSetupTime, 12);
  assert.equal(normalized.summary.testTotalTimeInMs, 42);
  assert.equal('isTestSetup' in normalized.tests[0], false);

  connection.tooling.request = async () => ({
    ...response,
    successes: [{ ...method, time: undefined }],
    failures: [],
    numFailures: 0,
    numTestsRun: 1,
    totalTime: null
  });
  const defaults = await api.run(connection, options);
  assert.equal(defaults.right.summary.outcome, 'Passed');
  assert.equal(defaults.right.tests[0].runTime, 0);
  assert.equal(defaults.right.summary.testExecutionTimeInMs, 0);

  connection.tooling.request = async () => ({ ...response, successes: 'invalid' });
  const malformed = await api.run(connection, options);
  assert.equal(malformed.left._tag, 'ApexResponseDecodeError');
  connection.tooling.request = async () => {
    throw new Error('Request rejected');
  };
  const rejected = await api.run(connection, options);
  assert.equal(rejected.left._tag, 'ApexOperationError');
  assert.equal(rejected.left.message, 'Request rejected');
  const invalidOptions = await api.run(connection, { tests: [{ className: 123 }] });
  assert.equal(invalidOptions.left._tag, 'ApexOperationError');

  // The trace-flag API must work in the same browser without host caches, services, or PubSub.
  const writes = [];
  let flags = [];
  let levels = [];
  const toolingConnection = {
    tooling: {
      query: async soql => {
        const records = soql.includes('FROM TraceFlag') ? flags : levels;
        return { done: true, totalSize: records.length, records };
      },
      create: async (type, payload) => {
        writes.push(['create', type, payload]);
        return { success: true, id: type === 'DebugLevel' ? '7dl000000000001' : '7tf000000000001', errors: [] };
      },
      update: async (type, payload) => {
        writes.push(['update', type, payload]);
        return { success: true, id: payload.Id, errors: [] };
      },
      delete: async (type, id) => {
        writes.push(['delete', type, id]);
        return { success: true, id, errors: [] };
      }
    }
  };
  const runTooling = async (operation, ...args) => {
    const result = await api.runTooling(operation, toolingConnection, ...args);
    assert.equal(result._tag, 'Right', result.left?.message);
    return result.right;
  };
  const payload = { DeveloperName: 'CallerLevel', MasterLabel: 'Caller Level', ApexCode: 'DEBUG' };
  assert.equal(await runTooling('getOrCreateDebugLevel', payload), '7dl000000000001');
  assert.deepEqual(JSON.parse(JSON.stringify(writes.pop())), ['create', 'DebugLevel', payload]);
  levels = [{ Id: '7dl000000000002' }];
  assert.equal(await runTooling('getOrCreateDebugLevel', payload), '7dl000000000002');
  assert.equal(writes.length, 0);

  let queriedSoql;
  const query = toolingConnection.tooling.query;
  toolingConnection.tooling.query = async soql => {
    queriedSoql = soql;
    return query(soql);
  };
  await runTooling('findDebugLevel', "a'\\b");
  assert.ok(queriedSoql.includes("DeveloperName = 'a\\'\\\\b'"));
  await runTooling('getTraceFlagForEntity', '005000000000001', 'USER_DEBUG', 'CreatedDate');
  assert.ok(queriedSoql.includes("LogType='USER_DEBUG'"));
  assert.ok(queriedSoql.includes('ORDER BY CreatedDate DESC LIMIT 1'));

  const created = await runTooling('ensureTraceFlag', '005000000000001', '7dl000000000003', {
    duration: '30 minutes',
    logType: 'USER_DEBUG'
  });
  assert.equal(created.created, true);
  assert.equal(created.traceFlagId, '7tf000000000001');
  assert.equal(writes.length, 1);
  assert.equal(writes[0][2].DebugLevelId, '7dl000000000003');
  assert.equal(writes[0][2].LogType, 'USER_DEBUG');
  writes.length = 0;

  const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  let notifications = 0;
  const onMutation = () =>
    api.notify(() => {
      notifications += 1;
    });
  flags = [{ Id: '7tf000000000002', DebugLevelId: '7dl000000000003', ExpirationDate: later }];
  const unchanged = await runTooling('ensureTraceFlag', '005000000000001', '7dl000000000003', { onMutation });
  assert.equal(unchanged.created, false);
  assert.equal(writes.length, 0);
  assert.equal(notifications, 0);
  await runTooling('ensureTraceFlag', '005000000000001', '7dl000000000004');
  assert.deepEqual(JSON.parse(JSON.stringify(writes.pop())), [
    'update',
    'TraceFlag',
    { Id: '7tf000000000002', DebugLevelId: '7dl000000000004' }
  ]);
  await runTooling('extendTraceFlag', flags[0]);
  assert.equal(writes.pop()[2].ExpirationDate, later);

  flags = [{ ...flags[0], ExpirationDate: new Date(Date.now() + 60_000).toISOString() }];
  await runTooling('ensureTraceFlag', '005000000000001', '7dl000000000003', { onMutation });
  const extended = writes.pop()[2];
  assert.ok(new Date(extended.ExpirationDate).getTime() > Date.now() + 29 * 60_000);
  flags = [{ ...flags[0], ExpirationDate: new Date(Date.now() - 60_000).toISOString() }];
  await runTooling('ensureTraceFlag', '005000000000001', '7dl000000000003', { onMutation });
  assert.deepEqual(
    writes.map(([operation]) => operation),
    ['delete', 'create']
  );
  assert.equal(notifications, 3);
  writes.length = 0;
  const create = toolingConnection.tooling.create;
  toolingConnection.tooling.create = async () => ({ success: false, errors: [{ message: 'create failed' }] });
  const failedEnsure = await api.runTooling(
    'ensureTraceFlag',
    toolingConnection,
    '005000000000001',
    '7dl000000000003',
    {
      onMutation
    }
  );
  assert.equal(failedEnsure.left._tag, 'ApexToolingMutationError');
  assert.equal(notifications, 4); // The successful delete still notified before the failed create.
  toolingConnection.tooling.create = create;
  writes.length = 0;
  // CLI's renewal helper intentionally updates an expired flag in place.
  await runTooling('extendTraceFlag', flags[0]);
  assert.deepEqual(
    writes.map(([operation]) => operation),
    ['update']
  );
  writes.length = 0;

  const toolingRecord = { Id: '7tf000000000002', LogType: 'USER_DEBUG', ExpirationDate: later };
  toolingConnection.tooling.query = async () => ({
    records: [toolingRecord],
    totalSize: 2,
    done: false,
    nextRecordsUrl: '/next'
  });
  toolingConnection.tooling.queryMore = async url => {
    assert.equal(url, '/next');
    return { records: [{ ...toolingRecord, Id: '7tf000000000003' }], totalSize: 2, done: true };
  };
  assert.equal((await runTooling('getTraceFlags')).length, 2);
  toolingConnection.tooling.query = async () => ({
    totalSize: 1,
    records: [{ Id: '7dl000000000005', DeveloperName: 'Level', MasterLabel: 'Level', Language: null, ApexCode: null }]
  });
  assert.equal((await runTooling('getDebugLevels'))[0].ApexCode, 'NONE');

  for (const [operation, method, args] of [
    ['createDebugLevel', 'create', [payload]],
    ['updateDebugLevel', 'update', ['7dl000000000005', { ApexCode: 'FINEST' }]],
    ['deleteDebugLevel', 'delete', ['7dl000000000005']],
    ['createTraceFlag', 'create', ['005000000000001', '7dl000000000005']],
    ['updateTraceFlag', 'update', ['7tf000000000002']],
    ['deleteTraceFlag', 'delete', ['7tf000000000002']],
    ['changeTraceFlagDebugLevel', 'update', ['7tf000000000002', '7dl000000000005']]
  ]) {
    const original = toolingConnection.tooling[method];
    toolingConnection.tooling[method] = async () => ({ success: false, errors: ['denied'] });
    assert.equal((await api.runTooling(operation, toolingConnection, ...args)).left._tag, 'ApexToolingMutationError');
    toolingConnection.tooling[method] = async () => ({ success: true, errors: [] });
    if (method === 'create') {
      assert.equal((await api.runTooling(operation, toolingConnection, ...args)).left._tag, 'ApexResponseDecodeError');
    }
    toolingConnection.tooling[method] = async () => ({ unexpected: true });
    assert.equal((await api.runTooling(operation, toolingConnection, ...args)).left._tag, 'ApexResponseDecodeError');
    toolingConnection.tooling[method] = async () => {
      throw new Error('denied');
    };
    assert.equal((await api.runTooling(operation, toolingConnection, ...args)).left._tag, 'ApexOperationError');
    toolingConnection.tooling[method] = original;
  }

  const fullEntry = join(consumerRoot, 'full-consumer.mjs');
  writeFileSync(
    fullEntry,
    "import { TestService } from '@salesforce/apex-node';\n" +
      "import { executeAnonymous, runTestSynchronous } from '@salesforce/apex-node/effect';\n" +
      'globalThis.apexNodeApi = { TestService, executeAnonymous, runTestSynchronous };\n'
  );
  await build({
    ...commonConfigBrowser,
    entryPoints: [fullEntry],
    sourcemap: false,
    write: false
  });
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}
