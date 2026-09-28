/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CodeCoverage } from './codeCoverage';
import type { QueryResult, Record as JsforceRecord } from '@jsforce/jsforce-node';
import { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { Progress } from '../common';
import { nls } from '../i18n';
import {
  ApexTestProgressValue,
  ApexTestResultData,
  ApexTestResultDataRaw,
  ApexTestSetupData,
  NamespaceInfo,
  TestCategory,
  TestResult,
  TestResultRaw
} from './types';

export function calculatePercentage(dividend: number, divisor: number): string {
  let percentage = '0%';
  if (dividend > 0) {
    const calcPct = ((dividend / divisor) * 100).toFixed();
    percentage = `${calcPct}%`;
  }
  return percentage;
}

type NsPrefixRecord = { NamespacePrefix: string };
type InstalledSubscriberRecord = { SubscriberPackage: NsPrefixRecord };

class NamespaceQueryError extends Schema.TaggedError<NamespaceQueryError>()('NamespaceQueryError', {
  message: Schema.String
}) {}

const emptyNsRecords: readonly NsPrefixRecord[] = [];

const queryNsRecords = <A>(query: () => PromiseLike<{ records: readonly A[] }>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(query()),
    catch: error => new NamespaceQueryError({ message: isError(error) ? error.message : String(error) })
  }).pipe(Effect.map(result => result.records));

const installedNsRecords = (connection: Connection) =>
  queryNsRecords(() => connection.query<NsPrefixRecord>('SELECT NamespacePrefix FROM PackageLicense')).pipe(
    Effect.orElse(() =>
      queryNsRecords(() =>
        connection.tooling.query<InstalledSubscriberRecord>(
          'SELECT SubscriberPackage.NamespacePrefix FROM InstalledSubscriberPackage'
        )
      ).pipe(Effect.map(records => records.map(rec => ({ NamespacePrefix: rec.SubscriberPackage.NamespacePrefix }))))
    ),
    Effect.orElseSucceed(() => emptyNsRecords)
  );

const orgNsRecords = (connection: Connection) =>
  queryNsRecords(() => connection.query<NsPrefixRecord>('SELECT NamespacePrefix FROM Organization')).pipe(
    Effect.orElseSucceed(() => emptyNsRecords)
  );

const toNamespaceInfo =
  (installedNs: boolean) =>
  (record: NsPrefixRecord): NamespaceInfo => ({
    installedNs,
    namespace: record.NamespacePrefix
  });

export const queryNamespaces = (connection: Connection): Promise<NamespaceInfo[]> =>
  Effect.all([installedNsRecords(connection), orgNsRecords(connection)], { concurrency: 'unbounded' }).pipe(
    Effect.map(([installedRecords, orgRecords]) => [
      ...orgRecords.map(toNamespaceInfo(false)),
      ...installedRecords.map(toNamespaceInfo(true))
    ]),
    Effect.runPromise
  );

export const queryAll = async <R extends JsforceRecord>(
  connection: Connection,
  query: string,
  tooling = false
): Promise<QueryResult<R>> => {
  const conn = tooling ? connection.tooling : connection;
  const allRecords: R[] = [];
  let result = await conn.query<R>(query);
  allRecords.push(...result.records);
  while (!result.done) {
    result = (await conn.queryMore(result.nextRecordsUrl ?? '')) as QueryResult<R>;
    allRecords.push(...result.records);
  }

  return {
    done: true,
    totalSize: allRecords.length,
    records: allRecords
  };
};

export const transformTestResult = (rawResult: TestResultRaw): TestResult => {
  // Initialize arrays for setup methods and regular tests
  const regularTests: ApexTestResultData[] = [];
  const setupMethods: ApexTestSetupData[] = [];

  // Iterate through each item in rawResult.tests
  rawResult.tests.forEach(test => {
    const { isTestSetup, ...rest } = test;
    if (isTestSetup) {
      setupMethods.push(transformToApexTestSetupData(rest));
    } else {
      regularTests.push(rest);
    }
  });

  return {
    summary: {
      ...rawResult.summary,
      testSetupTimeInMs: rawResult.summary.testSetupTimeInMs,
      testTotalTimeInMs: (rawResult.summary.testSetupTimeInMs || 0) + rawResult.summary.testExecutionTimeInMs
    },
    tests: regularTests,
    setup: setupMethods,
    codecoverage: rawResult.codecoverage
  };
};

export const calculateCodeCoverage = async (
  codeCoverageInstance: CodeCoverage,
  codeCoverage: boolean,
  apexTestClassIdSet: Set<string>,
  result: TestResultRaw,
  isAsync: boolean,
  progress?: Progress<ApexTestProgressValue>
): Promise<void> => {
  const coveredApexClassIdSet = new Set<string>();
  if (codeCoverage) {
    const perClassCovMap = await codeCoverageInstance.getPerClassCodeCoverage(apexTestClassIdSet);

    if (perClassCovMap.size > 0) {
      result.tests.forEach(item => {
        const keyCodeCov = `${item.apexClass.id}-${item.methodName}`;
        const perClassCov = perClassCovMap.get(keyCodeCov);
        // Skipped test is not in coverage map, check to see if perClassCov exists first
        if (perClassCov) {
          perClassCov.forEach(classCov => coveredApexClassIdSet.add(classCov.apexClassOrTriggerId));
          item.perClassCoverage = perClassCov;
        }
      });
    }
    if (isAsync) {
      progress?.report({
        type: 'FormatTestResultProgress',
        value: 'queryingForAggregateCodeCoverage',
        message: nls.localize('queryingForAggregateCodeCoverage')
      });
    }
    const { codeCoverageResults, totalLines, coveredLines } =
      await codeCoverageInstance.getAggregateCodeCoverage(coveredApexClassIdSet);
    result.codecoverage = codeCoverageResults;
    result.summary.totalLines = totalLines;
    result.summary.coveredLines = coveredLines;
    result.summary.testRunCoverage = calculatePercentage(coveredLines, totalLines);
    result.summary.orgWideCoverage = await codeCoverageInstance.getOrgWideCoverage();
  }
};

export const computeTestCategory = (testNamespace: string | null): TestCategory =>
  isFlowTest(testNamespace) ? 'Flow' : 'Apex';

export const isFlowTest = (test: string | null): boolean => test?.startsWith('FlowTesting.') ?? false;

const transformToApexTestSetupData = (testData: Omit<ApexTestResultDataRaw, 'isTestSetup'>): ApexTestSetupData =>
  // Assuming all necessary properties are present and optional properties are handled
  ({
    id: testData.id,
    stackTrace: testData.stackTrace ?? null,
    message: testData.message ?? null,
    asyncApexJobId: testData.asyncApexJobId,
    methodName: testData.methodName,
    apexLogId: testData.apexLogId ?? null,
    apexClass: testData.apexClass,
    testSetupTime: testData.runTime,
    testTimestamp: testData.testTimestamp,
    fullName: testData.fullName,
    diagnostic: testData.diagnostic
  });
