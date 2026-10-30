/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CodeCoverage } from './codeCoverage';
import type { QueryResult, Record as JsforceRecord } from '@jsforce/jsforce-node';
import { type Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { type Progress } from '../common';
import { queryNamespaces as queryNamespaceInfos } from '../effect/namespaces';
import { nls } from '../i18n';
import {
  ApexTestSetupDataSchema,
  type ApexTestProgressValue,
  type ApexTestResultData,
  type ApexTestResultDataRaw,
  type ApexTestSetupData,
  type NamespaceInfo,
  type TestCategory,
  type TestResult,
  type TestResultRaw
} from './types';

export function calculatePercentage(dividend: number, divisor: number): string {
  let percentage = '0%';
  if (dividend > 0) {
    const calcPct = ((dividend / divisor) * 100).toFixed();
    percentage = `${calcPct}%`;
  }
  return percentage;
}

export const queryNamespaces = (connection: Connection): Promise<NamespaceInfo[]> =>
  queryNamespaceInfos(connection).pipe(Effect.runPromise);

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
        if (isUndefined(item.apexClass.id)) return;
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

const isFlowTest = (test: string | null): boolean => test?.startsWith('FlowTesting.') ?? false;

const transformToApexTestSetupData = (testData: Omit<ApexTestResultDataRaw, 'isTestSetup'>): ApexTestSetupData =>
  Schema.decodeUnknownSync(ApexTestSetupDataSchema)({
    id: testData.id,
    ...(testData.stackTrace ? { stackTrace: testData.stackTrace } : {}),
    ...(testData.message ? { message: testData.message } : {}),
    asyncApexJobId: testData.asyncApexJobId,
    methodName: testData.methodName,
    apexLogId: testData.apexLogId ?? null,
    apexClass: {
      id: testData.apexClass.id,
      name: testData.apexClass.name,
      ...(testData.apexClass.namespacePrefix ? { namespacePrefix: testData.apexClass.namespacePrefix } : {}),
      fullName: testData.apexClass.fullName
    },
    testSetupTime: testData.runTime,
    ...(testData.testTimestamp ? { testTimestamp: testData.testTimestamp } : {}),
    fullName: testData.fullName,
    diagnostic: testData.diagnostic
  });
