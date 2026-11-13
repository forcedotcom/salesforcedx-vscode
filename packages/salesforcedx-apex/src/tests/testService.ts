/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  ApexTestProgressReporter,
  AsyncTestArrayConfiguration,
  AsyncTestConfiguration,
  OutputDirConfig,
  SyncTestConfiguration,
  TestLevel,
  TestResult,
  TestRunIdResult,
  TestSuiteMembershipRecord
} from './apiTypes';
import { type Connection } from '@salesforce/core';
import { type Duration } from '@salesforce/kit';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import { FileOutput } from '../effect/fileOutput';
import { NodeFileOutput } from '../effect/nodeFileOutput';
import { ApexOperationError, ApexResponseDecodeError } from '../effect/schema/errors';
import { ApexTestSuiteId } from '../effect/schema/salesforceId';
import { buildAsyncPayload, buildSyncPayload } from '../effect/testPayloads';
import { buildSuite, getTestsInSuite, retrieveAllSuites, retrieveSuiteId } from '../effect/testSuites';
import { writeResultFiles as writeResultFilesEffect } from '../effect/writeResultFiles';
import { nls } from '../i18n';
import { elapsedTime } from '../utils/elapsedTime';
import { HeapMonitor } from '../utils/heapMonitor';
import { AsyncTests } from './asyncTests';
import { type CancellationToken } from './cancellation';
import { formatTestErrors } from './diagnosticUtil';
import { SyncTests } from './syncTests';

type WriteTestResultOptions = {
  format?: 'markdown' | 'text';
  sortOrder?: 'runtime' | 'coverage' | 'severity';
  performanceThresholdMs?: number;
  coverageThresholdPercent?: number;
  timestamp?: Date;
  lineEnding?: '\n' | '\r\n';
  writeTestRunId?: boolean;
  includeSetup?: boolean;
};
/** Keeps typed failures as ordinary Promise rejections for existing class consumers. */
const runTestServiceOperation = async <A, E extends Error>(operation: Effect.Effect<A, E>): Promise<A> =>
  Result.getOrThrowWith(await operation.pipe(Effect.result, Effect.runPromise), formatTestErrors);

export class TestService {
  private readonly connection: Connection;
  private readonly asyncService: AsyncTests;
  private readonly syncService: SyncTests;

  constructor(connection: Connection) {
    this.connection = connection;
    this.syncService = new SyncTests(connection);
    this.asyncService = new AsyncTests(connection, NodeFileOutput);
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
    const suiteIdLookup: Effect.Effect<Option.Option<string>, ApexOperationError | ApexResponseDecodeError> = suitename
      ? retrieveSuiteId(this.connection, suitename)
      : Effect.succeed(Option.fromNullishOr(suiteId));
    return runTestServiceOperation(
      suiteIdLookup.pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(
                new ApexOperationError({
                  operation: 'getTestsInSuite',
                  message: nls.localize(
                    suitename === undefined && suiteId === undefined ? 'suitenameErr' : 'missingSuiteErr'
                  )
                })
              ),
            onSome: id =>
              Schema.decodeUnknownEffect(ApexTestSuiteId)(id).pipe(
                Effect.mapError(
                  cause =>
                    new ApexResponseDecodeError({
                      operation: 'getTestsInSuite',
                      message: 'Invalid suite id',
                      cause: cause.message
                    })
                ),
                Effect.flatMap(id => getTestsInSuite(this.connection, id))
              )
          })
        ),
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
    return runTestServiceOperation(buildSuite(this.connection, suitename, testClasses));
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
    codeCoverage = false,
    reportOptions: Omit<WriteTestResultOptions, 'codeCoverage'> = {}
  ): Promise<string[]> {
    HeapMonitor.getInstance().startMonitoring();
    HeapMonitor.getInstance().checkHeapSize('testService.writeResultFiles');
    try {
      return await runTestServiceOperation(
        writeResultFilesEffect(result, outputDirConfig, { ...reportOptions, codeCoverage }).pipe(
          Effect.provideService(FileOutput, NodeFileOutput)
        )
      );
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
}
