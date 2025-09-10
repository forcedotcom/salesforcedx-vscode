/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, Logger } from '@salesforce/core';
import {
  ApexTestProgressValue,
  ApexTestResultData,
  ApexTestResultDataRaw,
  ApexTestSetupData,
  NamespaceInfo,
  TestCategory,
  TestCategoryPrefix,
  TestResult,
  TestResultRaw
} from './types';
import type { QueryResult } from '@jsforce/jsforce-node';
import { Progress } from '../common';
import { nls } from '../i18n';
import { CodeCoverage } from './codeCoverage';

const DEFAULT_BUFFER_SIZE = 256;
const MIN_BUFFER_SIZE = 256;
const MAX_BUFFER_SIZE = 32_768;

const DEFAULT_JSON_INDENT: number | undefined = undefined;
const MIN_JSON_INDENT = 0;
const MAX_JSON_INDENT = 8;

let jsonIndent: number | null | undefined = null;
let bufferSize: number | null = null;

export function calculatePercentage(dividend: number, divisor: number): string {
  let percentage = '0%';
  if (dividend > 0) {
    const calcPct = ((dividend / divisor) * 100).toFixed();
    percentage = `${calcPct}%`;
  }
  return percentage;
}

export async function queryNamespaces(
  connection: Connection
): Promise<NamespaceInfo[]> {
  const installedNsQuery = 'SELECT NamespacePrefix FROM PackageLicense';
  const installedNsPromise = connection.query(installedNsQuery);
  const orgNsQuery = 'SELECT NamespacePrefix FROM Organization';
  const orgNsPromise = connection.query(orgNsQuery);

  const allNamespaces = await Promise.all([installedNsPromise, orgNsPromise]);
  const installedNamespaces = allNamespaces[0].records.map((record) => ({
    installedNs: true,
    namespace: record.NamespacePrefix
  }));
  const orgNamespaces = allNamespaces[1].records.map((record) => ({
    installedNs: false,
    namespace: record.NamespacePrefix
  }));

  return [...orgNamespaces, ...installedNamespaces];
}

export const queryAll = async <R>(
  connection: Connection,
  query: string,
  tooling = false
): Promise<QueryResult<R>> => {
  const conn = tooling ? connection.tooling : connection;
  const allRecords: R[] = [];
  let result = await conn.query<R>(query);
  allRecords.push(...result.records);
  while (!result.done) {
    result = (await conn.queryMore(result.nextRecordsUrl)) as QueryResult<R>;
    allRecords.push(...result.records);
  }

  return {
    done: true,
    totalSize: allRecords.length,
    records: allRecords
  };
};

export const getJsonIndent = (): number | undefined => {
  if (jsonIndent !== null) {
    return jsonIndent;
  }

  let jsonIndentNum = DEFAULT_JSON_INDENT;
  const envJsonIndent = process.env.SF_APEX_RESULTS_JSON_INDENT;

  if (envJsonIndent && Number.isInteger(Number(envJsonIndent))) {
    jsonIndentNum = Number(envJsonIndent);
  }

  if (jsonIndentNum < MIN_JSON_INDENT || jsonIndentNum > MAX_JSON_INDENT) {
    const logger: Logger = Logger.childFromRoot('utils');
    logger.warn(
      `Json indent ${jsonIndentNum} is outside of the valid range (${MIN_JSON_INDENT}-${MAX_JSON_INDENT}). Using default json indent of ${DEFAULT_JSON_INDENT}.`
    );
    jsonIndentNum = DEFAULT_JSON_INDENT;
  }

  jsonIndent = jsonIndentNum;
  return jsonIndent;
};

export const getBufferSize = (): number => {
  if (bufferSize !== null) {
    return bufferSize;
  }

  let bufferSizeNum = DEFAULT_BUFFER_SIZE;
  const jsonBufferSize = process.env.SF_APEX_JSON_BUFFER_SIZE;

  if (jsonBufferSize && Number.isInteger(Number(jsonBufferSize))) {
    bufferSizeNum = Number(jsonBufferSize);
  }

  if (bufferSizeNum < MIN_BUFFER_SIZE || bufferSizeNum > MAX_BUFFER_SIZE) {
    const logger: Logger = Logger.childFromRoot('utils');
    logger.warn(
      `Buffer size ${bufferSizeNum} is outside of the valid range (${MIN_BUFFER_SIZE}-${MAX_BUFFER_SIZE}). Using default buffer size of ${DEFAULT_BUFFER_SIZE}.`
    );
    bufferSizeNum = DEFAULT_BUFFER_SIZE;
  }

  bufferSize = bufferSizeNum;
  JSON.stringify(bufferSize);
  return bufferSize;
};

// exported for testing
export const resetLimitsForTesting = (): void => {
  bufferSize = null;
  jsonIndent = null;
};

export const transformTestResult = (rawResult: TestResultRaw): TestResult => {
  // Initialize arrays for setup methods and regular tests
  const regularTests: ApexTestResultData[] = [];
  const setupMethods: ApexTestSetupData[] = [];

  // Iterate through each item in rawResult.tests
  rawResult.tests.forEach((test) => {
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
      testTotalTimeInMs:
        (rawResult.summary.testSetupTimeInMs || 0) +
        rawResult.summary.testExecutionTimeInMs
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
    const perClassCovMap =
      await codeCoverageInstance.getPerClassCodeCoverage(apexTestClassIdSet);

    if (perClassCovMap.size > 0) {
      result.tests.forEach((item) => {
        const keyCodeCov = `${item.apexClass.id}-${item.methodName}`;
        const perClassCov = perClassCovMap.get(keyCodeCov);
        // Skipped test is not in coverage map, check to see if perClassCov exists first
        if (perClassCov) {
          perClassCov.forEach((classCov) =>
            coveredApexClassIdSet.add(classCov.apexClassOrTriggerId)
          );
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
      await codeCoverageInstance.getAggregateCodeCoverage(
        coveredApexClassIdSet
      );
    result.codecoverage = codeCoverageResults;
    result.summary.totalLines = totalLines;
    result.summary.coveredLines = coveredLines;
    result.summary.testRunCoverage = calculatePercentage(
      coveredLines,
      totalLines
    );
    result.summary.orgWideCoverage =
      await codeCoverageInstance.getOrgWideCoverage();
  }
};

export const computeTestCategory = (
  testNamespace: string | null
): TestCategory =>
  isFlowTest(testNamespace) ? TestCategory.Flow : TestCategory.Apex;

export const isFlowTest = (test: string | null): boolean =>
  test?.startsWith(TestCategoryPrefix.FlowTest) ?? false;

const transformToApexTestSetupData = (
  testData: Omit<ApexTestResultDataRaw, 'isTestSetup'>
): ApexTestSetupData =>
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
