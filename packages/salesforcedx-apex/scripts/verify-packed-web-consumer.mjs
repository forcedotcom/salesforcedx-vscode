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
    `import {
      executeAnonymous, ApexOperationError, buildSyncPayload, buildAsyncPayload, retrieveAllSuites, getTestsInSuite,
      buildSuite, runTestSynchronous, transformTestResult, SyncTestResultSchema, TestResultSchema,
      getOrgWideCoverage, getPerClassCodeCoverage, getAggregateCodeCoverage, CodeCoverageResultSchema
    } from '@salesforce/apex-node/effect';
    import * as Effect from 'effect/Effect';
    import * as Schema from 'effect/Schema';
    globalThis.apexEffectApi = {
      executeAnonymous, ApexOperationError, buildSyncPayload, buildAsyncPayload, retrieveAllSuites, getTestsInSuite,
      buildSuite, getOrgWideCoverage, getPerClassCodeCoverage, getAggregateCodeCoverage,
      CodeCoverageResultSchema, transformTestResult,
      run: (connection, options) => runTestSynchronous(connection, options).pipe(Effect.either, Effect.runPromise),
      decodeSyncResult: Schema.decodeUnknownSync(SyncTestResultSchema, { onExcessProperty: 'error' }),
      decodeResult: Schema.decodeUnknownSync(TestResultSchema)
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
