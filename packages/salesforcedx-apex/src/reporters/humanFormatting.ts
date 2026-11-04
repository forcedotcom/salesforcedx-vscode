/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'node:os';
import { nls } from '../i18n';
import { type ApexTestResultData, type CodeCoverageResult, type TestResult } from '../tests/types';
import { createTable, type Row } from '../utils';
import { formatTestTable } from './testTable';

const UNCOVERED_LINES_ARRAY_LIMIT = 5;

export const formatHuman = (
  testResult: TestResult,
  detailedCoverage: boolean,
  concise: boolean = false,
  showCategory: boolean = false
): string =>
  [
    ...(!testResult.codecoverage || !detailedCoverage
      ? [formatTestResults(testResult.tests, concise, showCategory)]
      : []),
    ...(testResult.codecoverage && detailedCoverage ? [formatDetailedCoverage(testResult, concise, showCategory)] : []),
    ...(testResult.codecoverage && !concise ? [formatCodeCoverage(testResult.codecoverage)] : []),
    ...(testResult.setup && !concise ? [formatSetup(testResult)] : []),
    formatSummary(testResult)
  ].join(os.EOL.repeat(2));

const formatSummary = (testResult: TestResult): string => {
  const summaryRowArray: Row[] = [
    { name: nls.localize('outcome'), value: testResult.summary.outcome },
    { name: nls.localize('testsRan'), value: String(testResult.summary.testsRan) },
    { name: nls.localize('passRate'), value: testResult.summary.passRate },
    { name: nls.localize('failRate'), value: testResult.summary.failRate },
    { name: nls.localize('skipRate'), value: testResult.summary.skipRate },
    ...(testResult.summary.testRunId ? [{ name: nls.localize('testRunId'), value: testResult.summary.testRunId }] : []),
    { name: nls.localize('testSetupTime'), value: `${testResult.summary.testSetupTimeInMs || 0} ms` },
    { name: nls.localize('testExecutionTime'), value: `${testResult.summary.testExecutionTimeInMs} ms` },
    { name: nls.localize('testTotalTime'), value: `${testResult.summary.testTotalTimeInMs} ms` },
    { name: nls.localize('orgId'), value: testResult.summary.orgId },
    ...(testResult.summary.username ? [{ name: nls.localize('username'), value: testResult.summary.username }] : []),
    ...(testResult.summary.orgWideCoverage
      ? [{ name: nls.localize('orgWideCoverage'), value: String(testResult.summary.orgWideCoverage) }]
      : [])
  ];

  return createTable(
    summaryRowArray,
    [
      { key: 'name', label: nls.localize('nameColHeader') },
      { key: 'value', label: nls.localize('valueColHeader') }
    ],
    nls.localize('testSummaryHeader')
  );
};

const formatTestResults = (tests: ApexTestResultData[], concise: boolean, showCategory: boolean): string => {
  const testRowArray: Row[] = tests
    .filter(elem => !concise || elem.outcome === 'Fail' || elem.outcome === 'CompileFail')
    .map(elem => ({
      name: elem.fullName,
      ...(showCategory && { category: elem.category }),
      outcome: elem.outcome,
      msg: buildMsg(elem),
      runtime: elem.outcome !== 'Fail' ? `${elem.runTime}` : ''
    }));

  return formatTestTable(testRowArray, nls.localize('testResultsHeader'), showCategory);
};

const formatSetup = (testResult: TestResult): string => {
  const testRowArray: Row[] = (testResult.setup ?? []).map(elem => ({
    name: elem.fullName,
    time: `${elem.testSetupTime}`
  }));
  if (testRowArray.length > 0) {
    const header = testResult.summary.testRunId
      ? nls.localize('testSetupResultsHeader').replace('runId', testResult.summary.testRunId)
      : nls.localize('testSetupResultsHeaderNoRunId');
    return createTable(
      testRowArray,
      [
        { key: 'name', label: nls.localize('testSetupMethodNameColHeader') },
        { key: 'time', label: nls.localize('setupTimeColHeader') }
      ],
      header
    );
  }
  return '';
};

const formatDetailedCoverage = (testResult: TestResult, concise: boolean, showCategory: boolean): string => {
  const header = testResult.summary.testRunId
    ? nls.localize('detailedCodeCovHeader', [testResult.summary.testRunId])
    : nls.localize('detailedCodeCovHeaderNoRunId');
  const testRowArray: Row[] = testResult.tests
    .filter(elem => !concise || elem.outcome === 'Fail' || elem.outcome === 'CompileFail')
    .flatMap(elem => {
      const base = {
        name: elem.fullName,
        ...(showCategory && { category: elem.category }),
        outcome: elem.outcome,
        msg: buildMsg(elem),
        runtime: `${elem.runTime}`
      };
      return elem.perClassCoverage
        ? elem.perClassCoverage.map(perClassCov => ({
            ...base,
            coveredClassName: perClassCov.apexClassOrTriggerName,
            coveredClassPercentage: perClassCov.percentage
          }))
        : [{ ...base, coveredClassName: '', coveredClassPercentage: '' }];
    });

  return formatTestTable(testRowArray, header, showCategory, true);
};

const formatCodeCoverage = (codeCoverages: CodeCoverageResult[]): string => {
  const codeCovRowArray: Row[] = codeCoverages.map(elem => ({
    name: elem.name,
    percent: elem.percentage,
    uncoveredLines: formatUncoveredLines(elem.uncoveredLines)
  }));

  return createTable(
    codeCovRowArray,
    [
      { key: 'name', label: nls.localize('classesColHeader') },
      { key: 'percent', label: nls.localize('percentColHeader') },
      { key: 'uncoveredLines', label: nls.localize('uncoveredLinesColHeader') }
    ],
    nls.localize('codeCovHeader')
  );
};

const buildMsg = (elem: ApexTestResultData): string =>
  elem.stackTrace ? `${elem.message}\n${elem.stackTrace}` : (elem.message ?? '');

const formatUncoveredLines = (uncoveredLines: number[]): string =>
  uncoveredLines.length === 0
    ? ''
    : uncoveredLines
        .slice(0, Math.min(uncoveredLines.length, UNCOVERED_LINES_ARRAY_LIMIT))
        .map(line => line.toString())
        .concat(uncoveredLines.length > UNCOVERED_LINES_ARRAY_LIMIT ? ['...'] : [])
        .join(',');
