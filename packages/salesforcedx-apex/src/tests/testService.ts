/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Connection } from '@salesforce/core';
import { type Duration } from '@salesforce/kit';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as FiberRef from 'effect/FiberRef';
import * as HashSet from 'effect/HashSet';
import * as Logger from 'effect/Logger';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { JsonStreamStringify } from 'json-stream-stringify';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, type Writable, type Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
<<<<<<< HEAD
=======
import { ApexOperationError } from '../effect/schema/errors';
>>>>>>> origin/sm/W-23839447
import { buildAsyncPayload, buildSyncPayload } from '../effect/testPayloads';
import { buildSuite, getTestsInSuite, retrieveAllSuites, retrieveSuiteId } from '../effect/testSuites';
import { nls } from '../i18n';
import { JUnitFormatTransformer, TapFormatTransformer, MarkdownTextFormatTransformer } from '../reporters';
import { TestResultStringifyStream } from '../streaming';
import { elapsedTime, HeapMonitor } from '../utils';
import { AsyncTests } from './asyncTests';
import { type CancellationToken } from './cancellation';
import { formatTestErrors } from './diagnosticUtil';
import { SyncTests } from './syncTests';
import {
  type ApexTestProgressReporter,
  type AsyncTestArrayConfiguration,
  type AsyncTestConfiguration,
  type OutputDirConfig,
  ResultFormat,
  type SyncTestConfiguration,
  type TestLevel,
  type TestResult,
  TestResultSchema,
  type TestRunIdResult,
  type TestSuiteMembershipRecord
} from './types';

/**
 * Standalone function for writing test result files - easier to test
 */
export const writeResultFiles = async (
  result: TestResult | TestRunIdResult,
  outputDirConfig: OutputDirConfig,
  codeCoverage = false,
  runPipeline: (readable: Readable, filePath: string, transform?: Transform) => Promise<string>
): Promise<string[]> => {
  const filesWritten: string[] = [];
  const { dirPath, resultFormats, fileInfos } = outputDirConfig;

  if (resultFormats && !resultFormats.every(Schema.is(ResultFormat))) {
    throw new Error(nls.localize('resultFormatErr'));
  }

  await mkdir(dirPath, { recursive: true });

  const hasTestResult = Schema.is(TestResultSchema)(result);
  const testRunId = hasTestResult ? result.summary.testRunId : result.testRunId;

  try {
    await writeFile(join(dirPath, 'test-run-id.txt'), testRunId);
    filesWritten.push(join(dirPath, 'test-run-id.txt'));
  } catch (err) {
    console.error(`Error writing file: ${err}`);
  }

  if (resultFormats && hasTestResult) {
    for (const format of resultFormats) {
      let filePath;
      let readable;
      switch (format) {
        case 'json':
          filePath = join(dirPath, `test-result-${testRunId || 'default'}.json`);
          readable = TestResultStringifyStream.fromTestResult(result);
          break;
        case 'tap':
          filePath = join(dirPath, `test-result-${testRunId}-tap.txt`);
          readable = new TapFormatTransformer(result);
          break;
        case 'junit':
          filePath = join(dirPath, `test-result-${testRunId || 'default'}-junit.xml`);
          readable = new JUnitFormatTransformer(result);
          break;
        case 'markdown':
          filePath = join(dirPath, `test-result-${testRunId || 'default'}.md`);
          readable = new MarkdownTextFormatTransformer(result, {
            format: 'markdown',
            codeCoverage
          });
          break;
        case 'text':
          filePath = join(dirPath, `test-result-${testRunId || 'default'}.txt`);
          readable = new MarkdownTextFormatTransformer(result, {
            format: 'text',
            codeCoverage
          });
          break;
        default:
          throw new Error(nls.localize('resultFormatErr'));
      }
      if (filePath && readable) {
        filesWritten.push(await runPipeline(readable, filePath));
      }
    }
  }

  if (codeCoverage && hasTestResult) {
    const filePath = join(dirPath, `test-result-${testRunId}-codecoverage.json`);
    const c = result.tests.map(record => record.perClassCoverage).filter(pcc => pcc?.length);
    filesWritten.push(await runPipeline(new JsonStreamStringify(c), filePath));
  }

  if (fileInfos) {
    for (const fileInfo of fileInfos) {
      const filePath = join(dirPath, fileInfo.filename);
      const readable =
        typeof fileInfo.content === 'string'
          ? Readable.from([fileInfo.content])
          : new JsonStreamStringify(fileInfo.content);
      filesWritten.push(await runPipeline(readable, filePath));
    }
  }

  return filesWritten;
};

/** Keeps typed failures as ordinary Promise rejections for existing class consumers. */
const runTestServiceOperation = async <A, E extends Error>(operation: Effect.Effect<A, E>): Promise<A> =>
  Either.getOrThrowWith(await operation.pipe(Effect.either, Effect.runPromise), formatTestErrors);

// Preserve the class API's plain console messages while Effect consumers select their own logger.
const suiteConsoleLogger = Logger.make(({ message }) => console.log(...(Array.isArray(message) ? message : [message])));

export class TestService {
  private readonly connection: Connection;
  private readonly asyncService: AsyncTests;
  private readonly syncService: SyncTests;

  constructor(connection: Connection) {
    this.connection = connection;
    this.syncService = new SyncTests(connection);
    this.asyncService = new AsyncTests(connection);
  }

  /**
   * Retrieve all suites in org
   * @returns list of Suites in org
   */
  public async retrieveAllSuites(): Promise<{ id: string; TestSuiteName: string }[]> {
    return runTestServiceOperation(retrieveAllSuites(this.connection).pipe(Effect.map(suites => [...suites])));
  }

  /**
   * Retrieves the test classes in a given suite
   * @param suitename name of suite
   * @param suiteId id of suite
   * @returns list of test classes in the suite
   * @internal Used by the co-repo Apex Testing extension; not part of the supported npm API.
   */
  public async getTestsInSuite(suitename?: string, suiteId?: string): Promise<TestSuiteMembershipRecord[]> {
    return runTestServiceOperation(
      (suitename ? retrieveSuiteId(this.connection, suitename) : Effect.succeed(suiteId)).pipe(
        Effect.filterOrFail(
          isNotUndefined,
          () =>
            new ApexOperationError({
              operation: 'getTestsInSuite',
              message: nls.localize(
                suitename === undefined && suiteId === undefined ? 'suitenameErr' : 'missingSuiteErr'
              )
            })
        ),
        Effect.flatMap(id => getTestsInSuite(this.connection, id)),
        Effect.map(members => [...members])
      )
    );
  }

  /**
   * Builds a test suite with the given test classes. Creates the test suite if it doesn't exist already
   * @param suitename name of suite
   * @param testClasses
   * @internal Used by the co-repo Apex Testing extension; not part of the supported npm API.
   */
  public async buildSuite(suitename: string, testClasses: string[]): Promise<void> {
    return runTestServiceOperation(
      buildSuite(this.connection, suitename, testClasses).pipe(
        Effect.locallyWith(FiberRef.currentLoggers, loggers =>
          loggers.pipe(HashSet.remove(Logger.defaultLogger), HashSet.add(suiteConsoleLogger))
        )
      )
    );
  }

  /**
   * Synchronous Test Runs
   * @param options Synchronous Test Runs configuration
   * @param codeCoverage should report code coverage
   * @param token cancellation token
   */
  @elapsedTime()
  public async runTestSynchronous(
    options: SyncTestConfiguration,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult | TestRunIdResult> {
    HeapMonitor.getInstance().startMonitoring();
    try {
      return await this.syncService.runTests(options, codeCoverage, token);
    } finally {
      HeapMonitor.getInstance().stopMonitoring();
    }
  }

  /**
   * Asynchronous Test Runs
   * @param options test options
   * @param codeCoverage should report code coverage
   * @param immediatelyReturn should not wait for test run to complete, return test run id immediately
   * @param progress progress reporter
   * @param token cancellation token
   * @param timeout
   */
  @elapsedTime()
  public async runTestAsynchronous(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false,
    immediatelyReturn = false,
    progress?: ApexTestProgressReporter,
    token?: CancellationToken,
    timeout?: Duration,
    interval?: Duration
  ): Promise<TestResult | TestRunIdResult> {
    HeapMonitor.getInstance().startMonitoring();
    try {
      return await this.asyncService.runTests(
        options,
        codeCoverage,
        immediatelyReturn,
        progress,
        token,
        timeout,
        interval
      );
    } finally {
      HeapMonitor.getInstance().stopMonitoring();
    }
  }

  /**
   * Report Asynchronous Test Run Results
   * @param testRunId test run id
   * @param codeCoverage should report code coverages
   * @param token cancellation token
   */
  @elapsedTime()
  public async reportAsyncResults(
    testRunId: string,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    HeapMonitor.getInstance().startMonitoring();
    try {
      return await this.asyncService.reportAsyncResults(testRunId, codeCoverage, token);
    } finally {
      HeapMonitor.getInstance().stopMonitoring();
    }
  }

  /**
   *
   * @param result test result
   * @param outputDirConfig config for result files
   * @param codeCoverage should report code coverage
   * @returns list of result files created
   */
  @elapsedTime()
  public async writeResultFiles(
    result: TestResult | TestRunIdResult,
    outputDirConfig: OutputDirConfig,
    codeCoverage = false
  ): Promise<string[]> {
    HeapMonitor.getInstance().startMonitoring();
    HeapMonitor.getInstance().checkHeapSize('testService.writeResultFiles');
    try {
      return await writeResultFiles(result, outputDirConfig, codeCoverage, this.runPipeline.bind(this));
    } finally {
      HeapMonitor.getInstance().checkHeapSize('testService.writeResultFiles');
      HeapMonitor.getInstance().stopMonitoring();
    }
  }

  /**
   * Utility function to help build payload for https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources_testing_runner_sync.htm
   */
  public async buildSyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classnames?: string,
    /**
     * Category for this run, for Flow or Apex. Can be a single category or an array of categories.
     */
    category?: string,
    /**
     * Specifies whether to opt out of collecting code coverage information during the test run ("true") or to collect code coverage information ("false").
     * @default false
     */
    skipCodeCoverage = false
  ): Promise<SyncTestConfiguration> {
    return runTestServiceOperation(
      buildSyncPayload(this.connection, { testLevel, tests, classNames: classnames, category, skipCodeCoverage })
    );
  }

  /**
   * Utility function to help build payload for https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources_testing_runner_async.htm
   */
  public async buildAsyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classNames?: string,
    suiteNames?: string,
    /**
     * Category for this run, for Flow or Apex. Can be a single category or an array of categories.
     */
    category?: string,
    /**
     * Specifies whether to opt out of collecting code coverage information during the test run ("true") or to collect code coverage information ("false").
     * @default false
     */
    skipCodeCoverage = false
  ): Promise<AsyncTestConfiguration | AsyncTestArrayConfiguration> {
    return runTestServiceOperation(
      buildAsyncPayload(this.connection, { testLevel, tests, classNames, suiteNames, category, skipCodeCoverage })
    );
  }

  private async runPipeline(readable: Readable, filePath: string, transform?: Transform): Promise<string> {
    const writable = this.createStream(filePath);
    if (transform) {
      await pipeline(readable, transform, writable);
    } else {
      await pipeline(readable, writable);
    }
    return filePath;
  }

  private createStream(filePath: string): Writable {
    return createWriteStream(filePath, 'utf8');
  }
}
