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

  it('exports tight Salesforce ID and coverage constraints', () => {
    expect(publicSchema.$defs.ApexClassId).toMatchObject({
      type: 'string',
      pattern: '^01p[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$'
    });
    expect(publicSchema.$defs.ApexTriggerId).toMatchObject({
      type: 'string',
      pattern: '^01q[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$'
    });
    expect(publicSchema.$defs.AsyncApexJobId).toMatchObject({
      type: 'string',
      pattern: '^707[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$'
    });
    expect(publicSchema.$defs.CoverageLineCount).toMatchObject({ type: 'integer', minimum: 0 });
    expect(publicSchema.$defs.ApexCodeCoverageRecord.properties).toMatchObject({
      ApexTestClassId: { $ref: '#/$defs/ApexClassId' },
      NumLinesCovered: { $ref: '#/$defs/CoverageLineCount' },
      NumLinesUncovered: { $ref: '#/$defs/CoverageLineCount' }
    });
  });

  it('exports the target major-version runtime symbols', () => {
    const coRepoOnlySymbols = new Set(['MarkdownTextFormatTransformer']);
    const supportedSymbols = Object.keys(publicApi).filter(symbol => !coRepoOnlySymbols.has(symbol));

    expect(supportedSymbols.sort()).toEqual([
      'CancellationTokenSource',
      'CoverageReporter',
      'DefaultReportOptions',
      'DefaultWatermarks',
      'ExecuteService',
      'HumanReporter',
      'JUnitReporter',
      'LogService',
      'TapReporter',
      'TestService'
    ]);
  });

  it('exports the Effect foundation from its isolated entry point', () => {
    expect(Object.keys(effectApi).sort()).toEqual([
      'AggregateCodeCoverageResultSchema',
      'ApexClassId',
      'ApexCodeCoverageAggregateRecordSchema',
      'ApexCodeCoverageAggregateSchema',
      'ApexCodeCoverageRecordSchema',
      'ApexCodeCoverageSchema',
      'ApexCompileError',
      'ApexDiagnosticSchema',
      'ApexLogBodyFetchError',
      'ApexLogId',
      'ApexLogListItem',
      'ApexLogQueryError',
      'ApexOperationError',
      'ApexOrgWideCoverageSchema',
      'ApexReportError',
      'ApexRequestError',
      'ApexResponseDecodeError',
      'ApexRuntimeError',
      'ApexTestResultDataRawSchema',
      'ApexTestResultDataSchema',
      'ApexTestResultOutcomeSchema',
      'ApexTestSetupDataSchema',
      'ApexTestSuiteId',
      'ApexTriggerId',
      'AsyncTestOptionsSchema',
      'AsyncTestProgressSchema',
      'AsyncTestResultSchema',
      'AsyncTestRunEventSchema',
      'BuildAsyncPayloadOptionsSchema',
      'BuildSyncPayloadOptionsSchema',
      'CodeCoverageResultSchema',
      'DefaultReportOptions',
      'DefaultWatermarks',
      'ExecuteAnonymousOptionsSchema',
      'ExecuteAnonymousOutcomeSchema',
      'FileOutput',
      'FileOutputError',
      'InvalidSessionError',
      'IstanbulReports',
      'ListLogsOptionsSchema',
      'LogStreamEventSchema',
      'PerClassCoverageSchema',
      'QueryPageSchema',
      'SalesforceId',
      'SyncTestConfigurationSchema',
      'SyncTestResultSchema',
      'TestItemSchema',
      'TestResultRawSchema',
      'TestResultSchema',
      'TestRunId',
      'TestSuiteMembershipSchema',
      'TestSuiteSchema',
      'UserId',
      'buildAsyncPayload',
      'buildCoverageMap',
      'buildSuite',
      'buildSyncPayload',
      'causeMessage',
      'executeAnonymous',
      'formatHumanReport',
      'formatJUnitReport',
      'formatMarkdownTextReport',
      'formatMarkdownTextReportStream',
      'formatSyncResults',
      'formatTapReport',
      'generateCoverageReports',
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
      'transformTestResult',
      'writeResultFiles'
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
