/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  ApexCodeCoverage,
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord,
  ApexCodeCoverageRecord,
  ApexDiagnostic,
  ApexExecuteOptions,
  ApexLogGetOptions,
  ApexTestProgressValue,
  ApexTestQueueItem,
  ApexTestQueueItemRecord,
  ApexTestQueueItemStatus,
  ApexTestResultData,
  ApexTestResultDataRaw,
  ApexTestResultOutcome,
  ApexTestRunResultStatus,
  ApexTestSetupData,
  AsyncTestArrayConfiguration,
  AsyncTestConfiguration,
  CodeCoverageResult,
  CommonOptions,
  ExecuteAnonymousResponse,
  LogLevel,
  LogRecord,
  LogResult,
  OutputDirConfig,
  PerClassCoverage,
  ResultFormat,
  SyncTestConfiguration,
  TestItem,
  TestLevel,
  TestResult,
  TestResultRaw,
  TestRunIdResult
} from '../src';
import * as Schema from 'effect/Schema';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as Prettier from 'prettier';
import {
  ApexClassId,
  ApexCodeCoverageAggregateRecordSchema,
  ApexCodeCoverageAggregateSchema,
  ApexCodeCoverageRecordSchema,
  ApexCodeCoverageSchema,
  ApexDiagnosticSchema,
  ApexLogId,
  AggregateCodeCoverageResultSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultDataSchema,
  ApexTestResultOutcomeSchema,
  ApexTestSetupDataSchema,
  ApexTestSuiteId,
  ApexCompileError,
  ApexOperationError,
  ApexOrgWideCoverageSchema,
  ApexResponseDecodeError,
  ApexReportError,
  ApexRuntimeError,
  AsyncTestOptionsSchema,
  AsyncTestProgressSchema,
  AsyncTestResultSchema,
  AsyncTestRunEventSchema,
  BuildSyncPayloadOptionsSchema,
  BuildAsyncPayloadOptionsSchema,
  CodeCoverageResultSchema,
  PerClassCoverageSchema,
  SyncTestConfigurationSchema,
  SyncTestResultSchema,
  TestItemSchema,
  TestResultRawSchema,
  TestResultSchema,
  TestSuiteSchema,
  TestSuiteMembershipSchema,
  TestRunId,
  ExecuteAnonymousOptionsSchema,
  ExecuteAnonymousOutcomeSchema,
  type BuildSyncPayloadOptions
} from '../src/effect';
import { ApexClassIdsSchema, ApexTestQueueItemId, ApexTestSuiteIdsSchema } from '../src/effect/schema/salesforceId';
import { ApexTestRunResultStatusSchema, TestLevelSchema } from '../src/effect/testTypes';

// JSON omits absent fields; V4's optional() JSON codec would instead admit null.
const optional = Schema.optionalKey;
const StringArray = Schema.Array(Schema.String);

const LogLevelSchema = Schema.Literals(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).annotate({
  identifier: 'LogLevel'
});

const CommonOptionsSchema = Schema.Struct({
  json: optional(Schema.Boolean),
  loglevel: optional(LogLevelSchema)
}).annotate({ identifier: 'CommonOptions' });

const ApexExecuteOptionsSchema = Schema.Struct({
  apexCode: Schema.String
}).annotate({ identifier: 'ApexExecuteOptions' });

const ExecuteAnonymousResponseSchema = Schema.Struct({
  compiled: Schema.Boolean,
  success: Schema.Boolean,
  logs: optional(Schema.String),
  diagnostic: ApexDiagnosticSchema.pipe(Schema.Array, optional)
}).annotate({ identifier: 'ExecuteAnonymousResponse' });

const ApexLogGetOptionsSchema = Schema.Struct({
  json: optional(Schema.Boolean),
  loglevel: optional(LogLevelSchema),
  numberOfLogs: optional(Schema.Finite),
  logId: optional(ApexLogId),
  outputDir: optional(Schema.String)
}).annotate({ identifier: 'ApexLogGetOptions' });

const LogRecordSchema = Schema.Struct({
  Id: ApexLogId,
  Application: Schema.String,
  DurationMilliseconds: Schema.Finite,
  Location: Schema.String,
  LogLength: Schema.Finite,
  LogUser: Schema.Struct({
    attributes: Schema.Record(Schema.String, Schema.Unknown),
    Name: Schema.String
  }),
  Operation: Schema.String,
  Request: Schema.String,
  StartTime: Schema.String,
  Status: Schema.String
}).annotate({ identifier: 'LogRecord' });

const LogResultSchema = Schema.Struct({
  logPath: optional(Schema.String),
  log: Schema.String
}).annotate({ identifier: 'LogResult' });

const ResultFormatSchema = Schema.Literals(['junit', 'tap', 'json', 'human', 'markdown', 'text']).annotate({
  identifier: 'ResultFormat'
});

const AsyncTestConfigurationSchema = Schema.Struct({
  classNames: optional(Schema.String),
  classids: optional(ApexClassIdsSchema),
  suiteNames: optional(Schema.String),
  suiteids: optional(ApexTestSuiteIdsSchema),
  maxFailedTests: optional(Schema.Finite),
  testLevel: TestLevelSchema,
  skipCodeCoverage: optional(Schema.Boolean),
  exitOnTestRunId: optional(Schema.Boolean),
  category: optional(StringArray)
}).annotate({ identifier: 'AsyncTestConfiguration' });

const AsyncTestArrayConfigurationSchema = Schema.Struct({
  tests: Schema.Array(TestItemSchema),
  maxFailedTests: optional(Schema.Finite),
  testLevel: TestLevelSchema,
  exitOnTestRunId: optional(Schema.Boolean),
  skipCodeCoverage: optional(Schema.Boolean),
  category: optional(StringArray)
}).annotate({ identifier: 'AsyncTestArrayConfiguration' });

const OutputDirConfigSchema = Schema.Struct({
  dirPath: Schema.String,
  resultFormats: ResultFormatSchema.pipe(Schema.Array, optional),
  fileInfos: Schema.Struct({
    filename: Schema.String,
    content: Schema.Union([Schema.String, Schema.ObjectKeyword])
  }).pipe(Schema.Array, optional)
}).annotate({ identifier: 'OutputDirConfig' });

const TestRunIdResultSchema = Schema.Struct({ testRunId: TestRunId }).annotate({ identifier: 'TestRunIdResult' });

const ApexTestQueueItemStatusSchema = Schema.Literals([
  'Holding',
  'Queued',
  'Preparing',
  'Processing',
  'Aborted',
  'Completed',
  'Failed'
]).annotate({ identifier: 'ApexTestQueueItemStatus' });

const ApexTestQueueItemRecordSchema = Schema.Struct({
  Id: ApexTestQueueItemId,
  Status: ApexTestQueueItemStatusSchema,
  ApexClassId: Schema.NullOr(ApexClassId),
  TestRunResultId: TestRunId
}).annotate({ identifier: 'ApexTestQueueItemRecord' });

const ApexTestQueueItemSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Finite,
  records: Schema.Array(ApexTestQueueItemRecordSchema)
}).annotate({ identifier: 'ApexTestQueueItem' });

const ApexTestProgressValueSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('StreamingClientProgress'),
    value: Schema.Literals(['streamingTransportUp', 'streamingTransportDown']),
    message: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal('StreamingClientProgress'),
    value: Schema.Literal('streamingProcessingTestRun'),
    testRunId: TestRunId,
    message: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal('PollingClientProgress'),
    value: Schema.Literal('pollingProcessingTestRun'),
    testRunId: TestRunId,
    message: Schema.String,
    classesCompleted: Schema.Finite,
    classesEnqueued: Schema.Finite
  }),
  Schema.Struct({ type: Schema.Literal('TestQueueProgress'), value: ApexTestQueueItemSchema }),
  Schema.Struct({
    type: Schema.Literal('FormatTestResultProgress'),
    value: Schema.Literals(['retrievingTestRunSummary', 'queryingForAggregateCodeCoverage']),
    message: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal('AbortTestRunProgress'),
    value: Schema.Literals(['abortingTestRun', 'abortingTestRunRequested']),
    message: Schema.String,
    testRunId: TestRunId
  })
]).annotate({ identifier: 'ApexTestProgressValue' });

const PublicApiSchema = Schema.Union([
  ApexCodeCoverageSchema,
  ApexCodeCoverageAggregateSchema,
  ApexCodeCoverageAggregateRecordSchema,
  ApexCodeCoverageRecordSchema,
  ApexDiagnosticSchema,
  ApexExecuteOptionsSchema,
  ApexLogGetOptionsSchema,
  ApexTestProgressValueSchema,
  ApexTestQueueItemSchema,
  ApexTestQueueItemRecordSchema,
  ApexTestQueueItemStatusSchema,
  ApexTestResultDataSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultOutcomeSchema,
  ApexTestRunResultStatusSchema,
  ApexTestSetupDataSchema,
  Schema.Struct({
    ...ApexCompileError.fields,
    line: Schema.Finite,
    column: Schema.Finite,
    logBody: optional(Schema.String)
  }).annotate({
    identifier: 'ApexCompileError'
  }),
  Schema.Struct({ ...ApexOperationError.fields, cause: optional(Schema.String) }).annotate({
    identifier: 'ApexOperationError'
  }),
  Schema.Struct({ ...ApexResponseDecodeError.fields, cause: optional(Schema.String) }).annotate({
    identifier: 'ApexResponseDecodeError'
  }),
  Schema.Struct({
    ...ApexRuntimeError.fields,
    line: Schema.Finite,
    column: Schema.Finite,
    logBody: optional(Schema.String)
  }).annotate({
    identifier: 'ApexRuntimeError'
  }),
  Schema.Struct({ ...ApexReportError.fields }).annotate({ identifier: 'ApexReportError' }),
  AggregateCodeCoverageResultSchema,
  AsyncTestArrayConfigurationSchema,
  AsyncTestConfigurationSchema,
  AsyncTestOptionsSchema,
  AsyncTestProgressSchema,
  AsyncTestResultSchema,
  AsyncTestRunEventSchema,
  BuildAsyncPayloadOptionsSchema,
  BuildSyncPayloadOptionsSchema,
  CodeCoverageResultSchema,
  CommonOptionsSchema,
  ExecuteAnonymousOptionsSchema,
  Schema.Struct({
    ...ExecuteAnonymousOutcomeSchema.fields,
    line: Schema.Finite,
    column: Schema.Finite,
    logBody: optional(Schema.String)
  }).annotate({
    identifier: 'ExecuteAnonymousOutcome'
  }),
  ExecuteAnonymousResponseSchema,
  LogLevelSchema,
  LogRecordSchema,
  LogResultSchema,
  OutputDirConfigSchema,
  ApexOrgWideCoverageSchema,
  PerClassCoverageSchema,
  SyncTestResultSchema,
  ResultFormatSchema,
  ApexTestSuiteId,
  SyncTestConfigurationSchema,
  TestSuiteSchema,
  TestSuiteMembershipSchema,
  TestItemSchema,
  TestLevelSchema,
  TestResultSchema,
  TestResultRawSchema,
  TestRunIdResultSchema
]).annotate({
  title: '@salesforce/apex-node public JSON API',
  description: 'JSON-representable values accepted or returned by the supported @salesforce/apex-node API.'
});

type JsonContract<T> = T extends Buffer
  ? { type: 'Buffer'; data: number[] }
  : T extends readonly (infer Item)[]
    ? JsonContract<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: JsonContract<T[Key]> }
      : T;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;
type Matches<Contract, Definition extends Schema.Codec<unknown, unknown>> = Equal<
  JsonContract<Contract>,
  JsonContract<Schema.Codec.Encoded<Definition>>
>;
type SerializableLogRecord = Omit<LogRecord, 'LogUser'> & {
  LogUser: { attributes: Record<string, unknown>; Name: string };
};

type PublicContractChecks = {
  ApexCodeCoverage: Matches<ApexCodeCoverage, typeof ApexCodeCoverageSchema>;
  ApexCodeCoverageAggregate: Matches<ApexCodeCoverageAggregate, typeof ApexCodeCoverageAggregateSchema>;
  ApexCodeCoverageAggregateRecord: Matches<
    ApexCodeCoverageAggregateRecord,
    typeof ApexCodeCoverageAggregateRecordSchema
  >;
  ApexCodeCoverageRecord: Matches<ApexCodeCoverageRecord, typeof ApexCodeCoverageRecordSchema>;
  ApexDiagnostic: Matches<ApexDiagnostic, typeof ApexDiagnosticSchema>;
  ApexExecuteOptions: Matches<ApexExecuteOptions, typeof ApexExecuteOptionsSchema>;
  ApexLogGetOptions: Matches<ApexLogGetOptions, typeof ApexLogGetOptionsSchema>;
  ApexTestProgressValue: Matches<ApexTestProgressValue, typeof ApexTestProgressValueSchema>;
  ApexTestQueueItem: Matches<ApexTestQueueItem, typeof ApexTestQueueItemSchema>;
  ApexTestQueueItemRecord: Matches<ApexTestQueueItemRecord, typeof ApexTestQueueItemRecordSchema>;
  ApexTestQueueItemStatus: Matches<ApexTestQueueItemStatus, typeof ApexTestQueueItemStatusSchema>;
  ApexTestResultData: Matches<ApexTestResultData, typeof ApexTestResultDataSchema>;
  ApexTestResultDataRaw: Matches<ApexTestResultDataRaw, typeof ApexTestResultDataRawSchema>;
  ApexTestResultOutcome: Matches<ApexTestResultOutcome, typeof ApexTestResultOutcomeSchema>;
  ApexTestRunResultStatus: Matches<ApexTestRunResultStatus, typeof ApexTestRunResultStatusSchema>;
  ApexTestSetupData: Matches<ApexTestSetupData, typeof ApexTestSetupDataSchema>;
  BuildSyncPayloadOptions: Matches<BuildSyncPayloadOptions, typeof BuildSyncPayloadOptionsSchema>;
  AsyncTestArrayConfiguration: Matches<AsyncTestArrayConfiguration, typeof AsyncTestArrayConfigurationSchema>;
  AsyncTestConfiguration: Matches<AsyncTestConfiguration, typeof AsyncTestConfigurationSchema>;
  CodeCoverageResult: Matches<CodeCoverageResult, typeof CodeCoverageResultSchema>;
  CommonOptions: Matches<CommonOptions, typeof CommonOptionsSchema>;
  ExecuteAnonymousResponse: Matches<ExecuteAnonymousResponse, typeof ExecuteAnonymousResponseSchema>;
  LogLevel: Matches<LogLevel, typeof LogLevelSchema>;
  LogRecord: Matches<SerializableLogRecord, typeof LogRecordSchema>;
  LogResult: Matches<LogResult, typeof LogResultSchema>;
  OutputDirConfig: Matches<OutputDirConfig, typeof OutputDirConfigSchema>;
  PerClassCoverage: Matches<PerClassCoverage, typeof PerClassCoverageSchema>;
  ResultFormat: Matches<ResultFormat, typeof ResultFormatSchema>;
  SyncTestConfiguration: Matches<SyncTestConfiguration, typeof SyncTestConfigurationSchema>;
  TestItem: Matches<TestItem, typeof TestItemSchema>;
  TestLevel: Matches<TestLevel, typeof TestLevelSchema>;
  TestResult: Matches<TestResult, typeof TestResultSchema>;
  TestResultRaw: Matches<TestResultRaw, typeof TestResultRawSchema>;
  TestRunIdResult: Matches<TestRunIdResult, typeof TestRunIdResultSchema>;
};
type FailedContracts = {
  [Contract in keyof PublicContractChecks]: PublicContractChecks[Contract] extends true ? never : Contract;
}[keyof PublicContractChecks];

const publicContractChecks: Record<FailedContracts, true> = {};
void publicContractChecks;

const schemaPath = join(__dirname, '..', 'schemas', 'public-api.schema.json');

const main = async (): Promise<void> => {
  const document = Schema.toJsonSchemaDocument(PublicApiSchema, { onExcessProperty: 'error' });
  // Keep the existing Draft-07 envelope and $defs reference paths for downstream validators.
  const generatedSchema = await Prettier.format(
    JSON.stringify({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $defs: document.definitions,
      ...document.schema
    }),
    {
      ...(await Prettier.resolveConfig(schemaPath)),
      filepath: schemaPath
    }
  );

  if (process.argv.includes('--check')) {
    const currentSchema = await readFile(schemaPath, 'utf-8').catch(() => '');
    if (currentSchema !== generatedSchema) {
      throw new Error('Public API schema is out of date. Run `npm run schema:update -w @salesforce/apex-node`.');
    }
    return;
  }

  await writeFile(schemaPath, generatedSchema, 'utf-8');
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
