/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as JSONSchema from 'effect/JSONSchema';
import * as Schema from 'effect/Schema';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as Prettier from 'prettier';
import {
  type ApexCodeCoverage,
  type ApexCodeCoverageAggregate,
  type ApexCodeCoverageAggregateRecord,
  type ApexCodeCoverageRecord,
  type ApexDiagnostic,
  type ApexExecuteOptions,
  type ApexLogGetOptions,
  type ApexTestProgressValue,
  type ApexTestQueueItem,
  type ApexTestQueueItemRecord,
  type ApexTestQueueItemStatus,
  type ApexTestResultData,
  type ApexTestResultDataRaw,
  type ApexTestResultOutcome,
  type ApexTestRunResultStatus,
  type ApexTestSetupData,
  type AsyncTestArrayConfiguration,
  type AsyncTestConfiguration,
  type CodeCoverageResult,
  type CommonOptions,
  type ExecuteAnonymousResponse,
  type LogLevel,
  type LogRecord,
  type LogResult,
  type OutputDirConfig,
  type PerClassCoverage,
  type ResultFormat,
  type SyncTestConfiguration,
  type TestItem,
  type TestLevel,
  type TestResult,
  type TestResultRaw,
  type TestRunIdResult
} from '../src';
import {
  ApexCompileError,
  ApexLogListItem,
  ApexLogQueryError,
  ApexLogBodyFetchError,
  ListLogsOptionsSchema,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  BuildSyncPayloadOptionsSchema,
  BuildAsyncPayloadOptionsSchema,
  ExecuteAnonymousOptionsSchema,
  ExecuteAnonymousOutcomeSchema,
  TestSuiteSchema,
  TestSuiteMembershipSchema
} from '../src/effect';
import { ApexLogPageSchema } from '../src/effect/schema/wire/logs';
import {
  ApexDiagnosticSchema,
  ApexTestRunResultStatusSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultDataSchema,
  ApexTestResultOutcomeSchema,
  ApexTestSetupDataSchema,
  CodeCoverageResultSchema,
  PerClassCoverageSchema,
  TestResultRawSchema,
  TestResultSchema
} from '../src/tests/types';

const optional = Schema.optional;
const StringArray = Schema.Array(Schema.String);
const NumberArray = Schema.Array(Schema.Number);

const LogLevelSchema = Schema.Literal('trace', 'debug', 'info', 'warn', 'error', 'fatal').annotations({
  identifier: 'LogLevel'
});

const CommonOptionsSchema = Schema.Struct({
  json: optional(Schema.Boolean),
  loglevel: optional(LogLevelSchema)
}).annotations({ identifier: 'CommonOptions' });

const SerializedBufferSchema = Schema.Struct({
  type: Schema.Literal('Buffer'),
  data: NumberArray
});

const ApexExecuteOptionsSchema = Schema.Struct({
  json: optional(Schema.Boolean),
  loglevel: optional(LogLevelSchema),
  targetUsername: optional(Schema.String),
  apexFilePath: optional(Schema.String),
  apexCode: optional(Schema.Union(Schema.String, SerializedBufferSchema)),
  userInput: optional(Schema.Boolean)
}).annotations({ identifier: 'ApexExecuteOptions' });

const ExecuteAnonymousResponseSchema = Schema.Struct({
  compiled: Schema.Boolean,
  success: Schema.Boolean,
  logs: optional(Schema.String),
  diagnostic: ApexDiagnosticSchema.pipe(Schema.Array, optional)
}).annotations({ identifier: 'ExecuteAnonymousResponse' });

const ApexLogGetOptionsSchema = Schema.Struct({
  json: optional(Schema.Boolean),
  loglevel: optional(LogLevelSchema),
  numberOfLogs: optional(Schema.Number),
  logId: optional(Schema.String),
  outputDir: optional(Schema.String)
}).annotations({ identifier: 'ApexLogGetOptions' });

const LogRecordSchema = Schema.Struct({
  Id: Schema.String,
  Application: Schema.String,
  DurationMilliseconds: Schema.Number,
  Location: Schema.String,
  LogLength: Schema.Number,
  LogUser: Schema.Struct({
    attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    Name: Schema.String
  }),
  Operation: Schema.String,
  Request: Schema.String,
  StartTime: Schema.String,
  Status: Schema.String
}).annotations({ identifier: 'LogRecord' });

const LogResultSchema = Schema.Struct({
  logPath: optional(Schema.String),
  log: Schema.String
}).annotations({ identifier: 'LogResult' });

const TestLevelSchema = Schema.Literal('RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests').annotations({
  identifier: 'TestLevel'
});

const ResultFormatSchema = Schema.Literal('junit', 'tap', 'json', 'human', 'markdown', 'text').annotations({
  identifier: 'ResultFormat'
});

const TestItemSchema = Schema.Struct({
  className: optional(Schema.String),
  classId: optional(Schema.String),
  testMethods: optional(StringArray),
  namespace: optional(Schema.String),
  category: optional(Schema.String)
}).annotations({ identifier: 'TestItem' });

const AsyncTestConfigurationSchema = Schema.Struct({
  classNames: optional(Schema.String),
  classids: optional(Schema.String),
  suiteNames: optional(Schema.String),
  suiteids: optional(Schema.String),
  maxFailedTests: optional(Schema.Number),
  testLevel: TestLevelSchema,
  skipCodeCoverage: optional(Schema.Boolean),
  exitOnTestRunId: optional(Schema.Boolean),
  category: optional(StringArray)
}).annotations({ identifier: 'AsyncTestConfiguration' });

const AsyncTestArrayConfigurationSchema = Schema.Struct({
  tests: Schema.Array(TestItemSchema),
  maxFailedTests: optional(Schema.Number),
  testLevel: TestLevelSchema,
  exitOnTestRunId: optional(Schema.Boolean),
  skipCodeCoverage: optional(Schema.Boolean),
  category: optional(StringArray)
}).annotations({ identifier: 'AsyncTestArrayConfiguration' });

const SyncTestConfigurationSchema = Schema.Struct({
  classNames: optional(Schema.String),
  tests: TestItemSchema.pipe(Schema.Array, optional),
  testLevel: optional(Schema.String),
  maxFailedTests: optional(Schema.Number),
  skipCodeCoverage: optional(Schema.Boolean),
  category: optional(StringArray)
}).annotations({ identifier: 'SyncTestConfiguration' });

const OutputDirConfigSchema = Schema.Struct({
  dirPath: Schema.String,
  resultFormats: ResultFormatSchema.pipe(Schema.Array, optional),
  fileInfos: Schema.Struct({
    filename: Schema.String,
    content: Schema.Union(Schema.String, Schema.Object)
  }).pipe(Schema.Array, optional)
}).annotations({ identifier: 'OutputDirConfig' });

const CoverageLinesSchema = Schema.Struct({
  coveredLines: NumberArray,
  uncoveredLines: NumberArray
});

const ApexCodeCoverageRecordSchema = Schema.Struct({
  ApexClassOrTrigger: Schema.Struct({ Id: Schema.String, Name: Schema.String }),
  ApexTestClassId: Schema.String,
  TestMethodName: Schema.String,
  NumLinesCovered: Schema.Number,
  NumLinesUncovered: Schema.Number,
  Coverage: optional(CoverageLinesSchema)
}).annotations({ identifier: 'ApexCodeCoverageRecord' });

const ApexCodeCoverageSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.Array(ApexCodeCoverageRecordSchema)
}).annotations({ identifier: 'ApexCodeCoverage' });

const ApexCodeCoverageAggregateRecordSchema = Schema.Struct({
  ApexClassOrTrigger: Schema.Struct({ Id: Schema.String, Name: Schema.String }),
  NumLinesCovered: Schema.Number,
  NumLinesUncovered: Schema.Number,
  Coverage: CoverageLinesSchema
}).annotations({ identifier: 'ApexCodeCoverageAggregateRecord' });

const ApexCodeCoverageAggregateSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.Array(ApexCodeCoverageAggregateRecordSchema)
}).annotations({ identifier: 'ApexCodeCoverageAggregate' });

const ApexTestQueueItemStatusSchema = Schema.Literal(
  'Holding',
  'Queued',
  'Preparing',
  'Processing',
  'Aborted',
  'Completed',
  'Failed'
).annotations({ identifier: 'ApexTestQueueItemStatus' });

const TestRunIdResultSchema = Schema.Struct({ testRunId: Schema.String }).annotations({
  identifier: 'TestRunIdResult'
});

const ApexTestQueueItemRecordSchema = Schema.Struct({
  Id: Schema.String,
  Status: ApexTestQueueItemStatusSchema,
  ApexClassId: Schema.NullOr(Schema.String),
  TestRunResultId: Schema.String
}).annotations({ identifier: 'ApexTestQueueItemRecord' });

const ApexTestQueueItemSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.Array(ApexTestQueueItemRecordSchema)
}).annotations({ identifier: 'ApexTestQueueItem' });

const ApexTestProgressValueSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('StreamingClientProgress'),
    value: Schema.Literal('streamingTransportUp', 'streamingTransportDown'),
    message: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal('StreamingClientProgress'),
    value: Schema.Literal('streamingProcessingTestRun'),
    testRunId: Schema.String,
    message: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal('PollingClientProgress'),
    value: Schema.Literal('pollingProcessingTestRun'),
    testRunId: Schema.String,
    message: Schema.String,
    classesCompleted: Schema.Number,
    classesEnqueued: Schema.Number
  }),
  Schema.Struct({ type: Schema.Literal('TestQueueProgress'), value: ApexTestQueueItemSchema }),
  Schema.Struct({
    type: Schema.Literal('FormatTestResultProgress'),
    value: Schema.Literal('retrievingTestRunSummary', 'queryingForAggregateCodeCoverage'),
    message: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal('AbortTestRunProgress'),
    value: Schema.Literal('abortingTestRun', 'abortingTestRunRequested'),
    message: Schema.String,
    testRunId: Schema.String
  })
).annotations({ identifier: 'ApexTestProgressValue' });

const PublicApiSchema = Schema.Union(
  ApexCodeCoverageSchema,
  ApexCodeCoverageAggregateSchema,
  ApexCodeCoverageAggregateRecordSchema,
  ApexCodeCoverageRecordSchema,
  ApexDiagnosticSchema,
  ApexExecuteOptionsSchema,
  ApexLogGetOptionsSchema,
  ApexLogListItem,
  ApexLogPageSchema,
  ApexLogQueryError,
  ApexLogBodyFetchError,
  ListLogsOptionsSchema,
  ApexTestProgressValueSchema,
  ApexTestQueueItemSchema,
  ApexTestQueueItemRecordSchema,
  ApexTestQueueItemStatusSchema,
  ApexTestResultDataSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultOutcomeSchema,
  ApexTestRunResultStatusSchema,
  ApexTestSetupDataSchema,
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  AsyncTestArrayConfigurationSchema,
  AsyncTestConfigurationSchema,
  CodeCoverageResultSchema,
  CommonOptionsSchema,
  BuildSyncPayloadOptionsSchema,
  BuildAsyncPayloadOptionsSchema,
  ExecuteAnonymousOptionsSchema,
  ExecuteAnonymousOutcomeSchema,
  ExecuteAnonymousResponseSchema,
  LogLevelSchema,
  LogRecordSchema,
  LogResultSchema,
  OutputDirConfigSchema,
  PerClassCoverageSchema,
  ResultFormatSchema,
  SyncTestConfigurationSchema,
  TestItemSchema,
  TestLevelSchema,
  TestResultSchema,
  TestResultRawSchema,
  TestRunIdResultSchema,
  TestSuiteSchema,
  TestSuiteMembershipSchema
).annotations({
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
type Matches<Contract, Definition extends Schema.Schema.Any> = Equal<
  JsonContract<Contract>,
  JsonContract<Schema.Schema.Type<Definition>>
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
  const generatedSchema = await Prettier.format(JSON.stringify(JSONSchema.make(PublicApiSchema)), {
    ...(await Prettier.resolveConfig(schemaPath)),
    filepath: schemaPath
  });

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
