/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { formatSyncResults, requestSyncTests } from '../effect/syncTests';
import { nls } from '../i18n';
import { elapsedTime, getCurrentTime, HeapMonitor } from '../utils';
import { type CancellationToken } from './cancellation';
import { CodeCoverage } from './codeCoverage';
import { formatTestErrors } from './diagnosticUtil';
import { type SyncTestConfiguration, type TestResult } from './types';
import { calculateCodeCoverage } from './utils';

export class SyncTests {
  public readonly connection: Connection;
  private readonly codecoverage: CodeCoverage;

  constructor(connection: Connection) {
    this.connection = connection;
    this.codecoverage = new CodeCoverage(this.connection);
  }

  /**
   * Synchronous Test Runs
   * @param options Synchronous Test Runs configuration
   * @param codeCoverage should report code coverage
   * @param token cancellation token
   */
  @elapsedTime()
  public async runTests(
    options: SyncTestConfiguration,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    HeapMonitor.getInstance().checkHeapSize('synctests.runTests');
    try {
      const execution = await requestSyncTests(this.connection, options).pipe(Effect.either, Effect.runPromise);
      // Keep Promise rejections free of the Effect runtime's FiberFailure prefix.
      if (Either.isLeft(execution)) throw new Error(execution.left.message);

      if (token?.isCancellationRequested) {
        throw new Error(nls.localize('testRunCancelled'));
      }

      return await this.formatSyncResults(execution.right, getCurrentTime(), codeCoverage);
    } catch (e) {
      throw formatTestErrors(e);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('synctests.runTests');
    }
  }

  @elapsedTime()
  public async formatSyncResults(apiTestResult: unknown, startTime: number, codeCoverage = false): Promise<TestResult> {
    HeapMonitor.getInstance().checkHeapSize('synctests.formatSyncResults');
    try {
      const formatted = await formatSyncResults(this.connection, apiTestResult, startTime).pipe(
        Effect.either,
        Effect.runPromise
      );
      if (Either.isLeft(formatted)) throw new Error(formatted.left.message);
      return await this.addCodeCoverage(formatted.right, codeCoverage);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('synctests.formatSyncResults');
    }
  }

  // Coverage retrieval retains its existing class implementation until its own migration.
  private async addCodeCoverage(result: TestResult, codeCoverage: boolean): Promise<TestResult> {
    await calculateCodeCoverage(
      this.codecoverage,
      codeCoverage,
      new Set(result.tests.map(test => test.apexClass.id)),
      result,
      false
    );
    return result;
  }
}
