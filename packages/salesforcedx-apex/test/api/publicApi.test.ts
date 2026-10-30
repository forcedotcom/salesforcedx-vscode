/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as publicApi from '../../src';
import * as effectApi from '../../src/effect';
import * as packageJson from '../../package.json';

describe('@salesforce/apex-node public API', () => {
  it('exports the target major-version runtime symbols', () => {
    const coRepoOnlySymbols = new Set(['MarkdownTextFormatTransformer']);
    const supportedSymbols = Object.keys(publicApi).filter(symbol => !coRepoOnlySymbols.has(symbol));

    expect(supportedSymbols.sort()).toEqual([
      'ApexClassId',
      'ApexLogId',
      'ApexTriggerId',
      'CancellationTokenSource',
      'CoverageReporter',
      'DefaultReportOptions',
      'DefaultWatermarks',
      'ExecuteService',
      'HumanReporter',
      'JUnitReporter',
      'LogService',
      'SalesforceId',
      'TapReporter',
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
