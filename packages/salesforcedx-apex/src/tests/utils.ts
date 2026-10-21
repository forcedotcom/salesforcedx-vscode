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
import { queryNamespaces as queryNamespaceInfos } from '../effect/namespaces';
import * as TestResults from '../effect/testResults';
export { calculatePercentage, computeTestCategory, isFlowTest, transformTestResult } from '../effect/testResults';
import { nls } from '../i18n';
import { type ApexTestProgressReporter, type NamespaceInfo, type TestResultRaw } from './types';

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

export const calculateCodeCoverage = async (
  codeCoverageInstance: CodeCoverage,
  codeCoverage: boolean,
  apexTestClassIdSet: Set<string>,
  result: TestResultRaw,
  isAsync: boolean,
  progress?: ApexTestProgressReporter
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
    result.summary.testRunCoverage = TestResults.calculatePercentage(coveredLines, totalLines);
    result.summary.orgWideCoverage = await codeCoverageInstance.getOrgWideCoverage();
  }
};
