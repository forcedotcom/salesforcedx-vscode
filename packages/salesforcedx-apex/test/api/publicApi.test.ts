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
      'CancellationTokenSource',
      'CoverageReporter',
      'DefaultReportOptions',
      'DefaultWatermarks',
      'ExecuteService',
      'HumanReporter',
      'JUnitReporter',
      'LogService',
      'ResultFormat',
      'SalesforceId',
      'TapReporter',
      'TestLevel',
      'TestRunId',
      'TestService'
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
      'ApexLogBodyFetchError',
      'ApexLogListItem',
      'ApexLogQueryError',
      'ApexOperationError',
<<<<<<< HEAD
=======
      'ApexOrgWideCoverageSchema',
>>>>>>> origin/sm/W-23839447
      'ApexReportError',
      'ApexResponseDecodeError',
      'ApexRuntimeError',
      'AsyncTestOptionsSchema',
      'AsyncTestProgressSchema',
      'AsyncTestResultSchema',
      'AsyncTestRunEventSchema',
      'BuildAsyncPayloadOptionsSchema',
      'BuildSyncPayloadOptionsSchema',
<<<<<<< HEAD
=======
      'CodeCoverageResultSchema',
>>>>>>> origin/sm/W-23839447
      'DefaultReportOptions',
      'DefaultWatermarks',
      'ExecuteAnonymousOptionsSchema',
      'ExecuteAnonymousOutcomeSchema',
      'IstanbulReports',
      'ListLogsOptionsSchema',
      'LogStreamEventSchema',
      'PerClassCoverageSchema',
      'TestSuiteMembershipSchema',
      'TestSuiteSchema',
      'buildAsyncPayload',
      'buildCoverageMap',
      'buildSuite',
      'buildSyncPayload',
      'causeMessage',
      'executeAnonymous',
      'formatHumanReport',
      'formatJUnitReport',
      'formatMarkdownTextReport',
      'formatTapReport',
      'generateCoverageReports',
<<<<<<< HEAD
=======
      'getAggregateCodeCoverage',
>>>>>>> origin/sm/W-23839447
      'getLogBody',
      'getOrgWideCoverage',
      'getPerClassCodeCoverage',
      'getTestsInSuite',
      'listLogs',
      'retrieveAllSuites',
      'runTestAsynchronous',
      'streamLogs'
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
