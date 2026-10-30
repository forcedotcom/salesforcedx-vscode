/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as publicApi from '../../src';
import * as effectApi from '../../src/effect';
import * as packageJson from '../../package.json';
import * as publicSchema from '../../schemas/public-api.schema.json';

describe('@salesforce/apex-node public API', () => {
  it.each([
    ['TestItem', ['className', 'classId', 'testMethods']],
    ['SyncTestConfiguration', ['tests', 'classNames', 'testLevel', 'maxFailedTests']],
    ['BuildSyncPayloadOptions', ['tests', 'classNames', 'testLevel', 'category']]
  ] as const)('preserves %s field definitions when exporting refinements to JSON Schema', (name, fields) => {
    expect(publicSchema.$defs[name]).toMatchObject({
      type: 'object',
      properties: Object.fromEntries(fields.map(field => [field, expect.anything()]))
    });
  });

  it('exports the target major-version runtime symbols', () => {
    const coRepoOnlySymbols = new Set(['MarkdownTextFormatTransformer']);
    const supportedSymbols = Object.keys(publicApi).filter(symbol => !coRepoOnlySymbols.has(symbol));

    expect(supportedSymbols.sort()).toEqual([
      'ApexClassId',
      'ApexLogId',
      'ApexTestSuiteId',
      'ApexTriggerId',
      'CancellationTokenSource',
      'CoverageReporter',
      'DefaultReportOptions',
      'DefaultWatermarks',
      'ExecuteService',
      'HumanReporter',
      'JUnitReporter',
      'LogService',
      'ResultFormat',
      'ResultFormatSchema',
      'SalesforceId',
      'TapReporter',
      'TestLevel',
      'TestLevelSchema',
      'TestRunId',
      'TestService',
      'UserId'
    ]);
  });

  it('exports the Effect foundation from its isolated entry point', () => {
    expect(Object.keys(effectApi).sort()).toEqual([
      'AggregateCodeCoverageResultSchema',
      'ApexCodeCoverageAggregateRecordSchema',
      'ApexCodeCoverageAggregateSchema',
      'ApexCodeCoverageRecordSchema',
      'ApexCodeCoverageSchema',
      'ApexCompileError',
      'ApexDiagnosticSchema',
      'ApexLogBodyFetchError',
      'ApexLogListItem',
      'ApexLogQueryError',
      'ApexOperationError',
      'ApexOrgWideCoverageSchema',
      'ApexResponseDecodeError',
      'ApexRuntimeError',
      'ApexTestResultDataRawSchema',
      'ApexTestResultDataSchema',
      'ApexTestResultOutcomeSchema',
      'ApexTestSetupDataSchema',
      'ApexTestSuiteId',
      'AsyncTestOptionsSchema',
      'AsyncTestProgressSchema',
      'AsyncTestResultSchema',
      'AsyncTestRunEventSchema',
      'BuildAsyncPayloadOptionsSchema',
      'BuildSyncPayloadOptionsSchema',
      'CodeCoverageResultSchema',
      'ExecuteAnonymousOptionsSchema',
      'ExecuteAnonymousOutcomeSchema',
      'ListLogsOptionsSchema',
      'LogStreamEventSchema',
      'PerClassCoverageSchema',
      'QueryPageSchema',
      'SyncTestConfigurationSchema',
      'SyncTestResultSchema',
      'TestItemSchema',
      'TestResultRawSchema',
      'TestResultSchema',
      'TestSuiteMembershipSchema',
      'TestSuiteSchema',
      'buildAsyncPayload',
      'buildSuite',
      'buildSyncPayload',
      'causeMessage',
      'executeAnonymous',
      'formatSyncResults',
      'getAggregateCodeCoverage',
      'getDiagnostic',
      'getLogBody',
      'getOrgWideCoverage',
      'getPerClassCodeCoverage',
      'getTestsInSuite',
      'listLogs',
      'retrieveAllSuites',
      'runTestAsynchronous',
      'runTestSynchronous',
      'streamLogs',
      'transformTestResult'
    ]);
  });

  it('restricts consumers to the target major-version package entry points', () => {
    expect(packageJson.exports).toEqual({
      '.': {
        types: './out/src/index.d.ts',
        default: './out/src/index.js'
      },
      './effect': {
        types: './out/src/effect/index.d.ts',
        default: './out/src/effect/index.js'
      }
    });
  });
});
