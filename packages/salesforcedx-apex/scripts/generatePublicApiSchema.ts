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
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  ExecuteAnonymousOptionsSchema,
  ExecuteAnonymousOutcomeSchema
} from '../src/effect';

// JSON omits absent fields; V4's optional() JSON codec would instead admit null.
const optional = Schema.optionalKey;
const StringArray = Schema.Array(Schema.String);
const NumberArray = Schema.Array(Schema.Finite);

const LogLevelSchema = Schema.Literals(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).annotate({
  identifier: 'LogLevel'
});

const CommonOptionsSchema = Schema.Struct({
  json: optional(Schema.Boolean),
  loglevel: optional(LogLevelSchema)
}).annotate({ identifier: 'CommonOptions' });

const ApexDiagnosticSchema = Schema.Struct({
  lineNumber: optional(Schema.Finite),
  columnNumber: optional(Schema.Finite),
  exceptionMessage: Schema.String,
  compileProblem: Schema.String,
  exceptionStackTrace: Schema.String,
  className: optional(Schema.String)
}).annotate({ identifier: 'ApexDiagnostic' });

const SerializedBufferSchema = Schema.Struct({
  type: Schema.Literal('Buffer'),
  data: NumberArray
});

const ApexExecuteOptionsSchema = Schema.Struct({
  json: optional(Schema.Boolean),
  loglevel: optional(LogLevelSchema),
  targetUsername: optional(Schema.String),
  apexFilePath: optional(Schema.String),
  apexCode: optional(Schema.Union([Schema.String, SerializedBufferSchema])),
  userInput: optional(Schema.Boolean)
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
  logId: optional(Schema.String),
  outputDir: optional(Schema.String)
}).annotate({ identifier: 'ApexLogGetOptions' });

const LogRecordSchema = Schema.Struct({
  Id: Schema.String,
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

const TestLevelSchema = Schema.Literals(['RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests']).annotate({
  identifier: 'TestLevel'
});

const ResultFormatSchema = Schema.Literals(['junit', 'tap', 'json', 'human', 'markdown', 'text']).annotate({
  identifier: 'ResultFormat'
});

const TestItemSchema = Schema.Struct({
  className: optional(Schema.String),
  classId: optional(Schema.String),
  testMethods: optional(StringArray),
  namespace: optional(Schema.String),
  category: optional(Schema.String)
}).annotate({ identifier: 'TestItem' });

const AsyncTestConfigurationSchema = Schema.Struct({
  classNames: optional(Schema.String),
  classids: optional(Schema.String),
  suiteNames: optional(Schema.String),
  suiteids: optional(Schema.String),
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

const SyncTestConfigurationSchema = Schema.Struct({
  classNames: optional(Schema.String),
  tests: TestItemSchema.pipe(Schema.Array, optional),
  testLevel: optional(Schema.String),
  maxFailedTests: optional(Schema.Finite),
  skipCodeCoverage: optional(Schema.Boolean),
  category: optional(StringArray)
}).annotate({ identifier: 'SyncTestConfiguration' });

const OutputDirConfigSchema = Schema.Struct({
  dirPath: Schema.String,
  resultFormats: ResultFormatSchema.pipe(Schema.Array, optional),
  fileInfos: Schema.Struct({
    filename: Schema.String,
    content: Schema.Union([Schema.String, Schema.ObjectKeyword])
  }).pipe(Schema.Array, optional)
}).annotate({ identifier: 'OutputDirConfig' });

const CoverageLinesSchema = Schema.Struct({
  coveredLines: NumberArray,
  uncoveredLines: NumberArray
});

const ApexCodeCoverageRecordSchema = Schema.Struct({
  ApexClassOrTrigger: Schema.Struct({ Id: Schema.String, Name: Schema.String }),
  ApexTestClassId: Schema.String,
  TestMethodName: Schema.String,
  NumLinesCovered: Schema.Finite,
  NumLinesUncovered: Schema.Finite,
  Coverage: optional(CoverageLinesSchema)
}).annotate({ identifier: 'ApexCodeCoverageRecord' });

const ApexCodeCoverageSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Finite,
  records: Schema.Array(ApexCodeCoverageRecordSchema)
}).annotate({ identifier: 'ApexCodeCoverage' });

const ApexCodeCoverageAggregateRecordSchema = Schema.Struct({
  ApexClassOrTrigger: Schema.Struct({ Id: Schema.String, Name: Schema.String }),
  NumLinesCovered: Schema.Finite,
  NumLinesUncovered: Schema.Finite,
  Coverage: CoverageLinesSchema
}).annotate({ identifier: 'ApexCodeCoverageAggregateRecord' });

const ApexCodeCoverageAggregateSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Finite,
  records: Schema.Array(ApexCodeCoverageAggregateRecordSchema)
}).annotate({ identifier: 'ApexCodeCoverageAggregate' });

const PerClassCoverageSchema = Schema.Struct({
  apexClassOrTriggerName: Schema.String,
  apexClassOrTriggerId: Schema.String,
  apexTestClassId: Schema.String,
  apexTestMethodName: Schema.String,
  numLinesCovered: Schema.Finite,
  numLinesUncovered: Schema.Finite,
  percentage: Schema.String,
  coverage: optional(CoverageLinesSchema)
}).annotate({ identifier: 'PerClassCoverage' });

const ApexTestResultOutcomeSchema = Schema.Literals(['Pass', 'Fail', 'CompileFail', 'Skip']).annotate({
  identifier: 'ApexTestResultOutcome'
});

const ApexTestRunResultStatusSchema = Schema.Literals([
  'Queued',
  'Processing',
  'Aborted',
  'Passed',
  'Failed',
  'Completed',
  'Skipped'
]).annotate({ identifier: 'ApexTestRunResultStatus' });

const ApexTestQueueItemStatusSchema = Schema.Literals([
  'Holding',
  'Queued',
  'Preparing',
  'Processing',
  'Aborted',
  'Completed',
  'Failed'
]).annotate({ identifier: 'ApexTestQueueItemStatus' });

const ApexClassSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  namespacePrefix: Schema.String,
  fullName: Schema.String
});

const ApexTestResultDataSchema = Schema.Struct({
  id: Schema.String,
  queueItemId: Schema.String,
  stackTrace: Schema.NullOr(Schema.String),
  message: Schema.NullOr(Schema.String),
  asyncApexJobId: Schema.String,
  methodName: Schema.String,
  outcome: ApexTestResultOutcomeSchema,
  apexLogId: Schema.NullOr(Schema.String),
  apexClass: ApexClassSchema,
  runTime: Schema.Finite,
  testTimestamp: Schema.String,
  fullName: Schema.String,
  perClassCoverage: PerClassCoverageSchema.pipe(Schema.Array, optional),
  diagnostic: optional(ApexDiagnosticSchema),
  category: optional(Schema.String)
}).annotate({ identifier: 'ApexTestResultData' });

const ApexTestResultDataRawSchema = Schema.Struct({
  ...ApexTestResultDataSchema.fields,
  isTestSetup: optional(Schema.Boolean)
}).annotate({ identifier: 'ApexTestResultDataRaw' });

const ApexTestSetupDataSchema = Schema.Struct({
  id: Schema.String,
  stackTrace: Schema.NullOr(Schema.String),
  message: Schema.NullOr(Schema.String),
  asyncApexJobId: Schema.String,
  methodName: Schema.String,
  apexLogId: Schema.NullOr(Schema.String),
  apexClass: ApexClassSchema,
  testSetupTime: Schema.Finite,
  testTimestamp: Schema.String,
  fullName: Schema.String,
  diagnostic: optional(ApexDiagnosticSchema)
}).annotate({ identifier: 'ApexTestSetupData' });

const CodeCoverageResultSchema = Schema.Struct({
  apexId: Schema.String,
  name: Schema.String,
  type: Schema.Literals(['ApexClass', 'ApexTrigger']),
  numLinesCovered: Schema.Finite,
  numLinesUncovered: Schema.Finite,
  percentage: Schema.String,
  coveredLines: NumberArray,
  uncoveredLines: NumberArray
}).annotate({ identifier: 'CodeCoverageResult' });

const TestResultSummarySchema = Schema.Struct({
  failRate: Schema.String,
  testsRan: Schema.Finite,
  orgId: Schema.String,
  outcome: Schema.String,
  passing: Schema.Finite,
  failing: Schema.Finite,
  skipped: Schema.Finite,
  passRate: Schema.String,
  skipRate: Schema.String,
  testStartTime: Schema.String,
  testExecutionTimeInMs: Schema.Finite,
  testTotalTimeInMs: Schema.Finite,
  testSetupTimeInMs: optional(Schema.Finite),
  commandTimeInMs: Schema.Finite,
  hostname: Schema.String,
  username: Schema.String,
  testRunId: Schema.String,
  userId: Schema.String,
  testRunCoverage: optional(Schema.String),
  orgWideCoverage: optional(Schema.String),
  totalLines: optional(Schema.Finite),
  coveredLines: optional(Schema.Finite)
});

const TestResultRawSchema = Schema.Struct({
  summary: TestResultSummarySchema,
  tests: Schema.Array(ApexTestResultDataRawSchema),
  codecoverage: CodeCoverageResultSchema.pipe(Schema.Array, optional)
}).annotate({ identifier: 'TestResultRaw' });

const TestResultSchema = Schema.Struct({
  summary: TestResultSummarySchema,
  tests: Schema.Array(ApexTestResultDataSchema),
  setup: ApexTestSetupDataSchema.pipe(Schema.Array, optional),
  codecoverage: CodeCoverageResultSchema.pipe(Schema.Array, optional)
}).annotate({ identifier: 'TestResult' });

const TestRunIdResultSchema = Schema.Struct({ testRunId: Schema.String }).annotate({
  identifier: 'TestRunIdResult'
});

const ApexTestQueueItemRecordSchema = Schema.Struct({
  Id: Schema.String,
  Status: ApexTestQueueItemStatusSchema,
  ApexClassId: Schema.NullOr(Schema.String),
  TestRunResultId: Schema.String
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
    testRunId: Schema.String,
    message: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal('PollingClientProgress'),
    value: Schema.Literal('pollingProcessingTestRun'),
    testRunId: Schema.String,
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
    testRunId: Schema.String
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
  AsyncTestArrayConfigurationSchema,
  AsyncTestConfigurationSchema,
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
  PerClassCoverageSchema,
  ResultFormatSchema,
  SyncTestConfigurationSchema,
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
type Matches<Contract, Definition extends Schema.Constraint> = Equal<
  JsonContract<Contract>,
  JsonContract<Definition['Type']>
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
