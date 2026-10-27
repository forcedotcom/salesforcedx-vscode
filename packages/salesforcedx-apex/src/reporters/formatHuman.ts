/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Row } from '../utils/types';
import { messages } from '../i18n/i18n';
import { type ApexTestResultData, type CodeCoverageResult, type TestResult } from '../tests/types';
<<<<<<< HEAD
import { formatTable } from '../utils/formatTable';
=======
import { formatTable } from './formatTable';
>>>>>>> origin/sm/W-23839447

const UNCOVERED_LINES_ARRAY_LIMIT = 5;

export const formatHuman = (
  testResult: TestResult,
  detailedCoverage: boolean,
  concise: boolean = false,
  showCategory: boolean = false,
<<<<<<< HEAD
  lineEnding = globalThis.process?.platform === 'win32' ? '\r\n' : '\n'
): string =>
  [
    ...(!testResult.codecoverage || !detailedCoverage
      ? [formatTestResults(testResult.tests, concise, showCategory)]
      : []),
    ...(testResult.codecoverage && detailedCoverage ? [formatDetailedCov(testResult, concise, showCategory)] : []),
    ...(testResult.codecoverage && !concise ? [formatCodeCov(testResult.codecoverage)] : []),
    ...(testResult.setup && !concise ? [formatSetup(testResult)] : []),
    formatSummary(testResult)
  ].join(lineEnding.repeat(2));

const formatSummary = (testResult: TestResult): string => {
=======
  lineEnding = '\n'
): string =>
  [
    ...(!testResult.codecoverage || !detailedCoverage
      ? [formatTestResults(testResult.tests, concise, showCategory, lineEnding)]
      : []),
    ...(testResult.codecoverage && detailedCoverage
      ? [formatDetailedCov(testResult, concise, showCategory, lineEnding)]
      : []),
    ...(testResult.codecoverage && !concise ? [formatCodeCov(testResult.codecoverage, lineEnding)] : []),
    ...(testResult.setup && !concise ? [formatSetup(testResult, lineEnding)] : []),
    formatSummary(testResult, lineEnding)
  ].join(lineEnding.repeat(2));

const formatSummary = (testResult: TestResult, lineEnding: string): string => {
>>>>>>> origin/sm/W-23839447
  // Summary Table
  const summaryRowArray: Row[] = [
    {
      name: messages.outcome,
      value: testResult.summary.outcome
    },
    {
      name: messages.testsRan,
      value: String(testResult.summary.testsRan)
    },
    {
      name: messages.passRate,
      value: testResult.summary.passRate
    },
    {
      name: messages.failRate,
      value: testResult.summary.failRate
    },
    {
      name: messages.skipRate,
      value: testResult.summary.skipRate
    },
    {
      name: messages.testRunId,
      value: testResult.summary.testRunId
    },
    {
      name: messages.testSetupTime,
      value: `${testResult.summary.testSetupTimeInMs || 0} ms`
    },
    {
      name: messages.testExecutionTime,
      value: `${testResult.summary.testExecutionTimeInMs} ms`
    },
    {
      name: messages.testTotalTime,
      value: `${testResult.summary.testTotalTimeInMs} ms`
    },
    {
      name: messages.orgId,
      value: testResult.summary.orgId
    },
    {
      name: messages.username,
      value: testResult.summary.username
    },
    ...(testResult.summary.orgWideCoverage
      ? [
          {
            name: messages.orgWideCoverage,
            value: String(testResult.summary.orgWideCoverage)
          }
        ]
      : [])
  ];

  return formatTable(
    summaryRowArray,
    [
      {
        key: 'name',
        label: messages.nameColHeader
      },
      { key: 'value', label: messages.valueColHeader }
    ],
<<<<<<< HEAD
    messages.testSummaryHeader
  );
};

const formatTestResults = (tests: ApexTestResultData[], concise: boolean, showCategory: boolean): string => {
=======
    messages.testSummaryHeader,
    lineEnding
  );
};

const formatTestResults = (
  tests: ApexTestResultData[],
  concise: boolean,
  showCategory: boolean,
  lineEnding: string
): string => {
>>>>>>> origin/sm/W-23839447
  const testRowArray: Row[] = tests
    .filter(elem => !concise || elem.outcome === 'Fail' || elem.outcome === 'CompileFail')
    .map(elem => ({
      name: elem.fullName,
      ...(showCategory && { category: elem.category }),
      outcome: elem.outcome,
      msg: buildMsg(elem),
      runtime: elem.outcome !== 'Fail' ? `${elem.runTime}` : ''
    }));

  if (testRowArray.length > 0) {
    return formatTable(
      testRowArray,
      [
        { key: 'name', label: messages.testNameColHeader },
        ...(showCategory ? [{ key: 'category', label: messages.categoryColHeader }] : []),
        { key: 'outcome', label: messages.outcomeColHeader },
        { key: 'msg', label: messages.msgColHeader },
        { key: 'runtime', label: messages.runtimeColHeader }
      ],
<<<<<<< HEAD
      messages.testResultsHeader
=======
      messages.testResultsHeader,
      lineEnding
>>>>>>> origin/sm/W-23839447
    );
  }
  return '';
};

<<<<<<< HEAD
const formatSetup = (testResult: TestResult): string => {
=======
const formatSetup = (testResult: TestResult, lineEnding: string): string => {
>>>>>>> origin/sm/W-23839447
  const testRowArray: Row[] = (testResult.setup ?? []).map(elem => ({
    name: elem.fullName,
    time: `${elem.testSetupTime}`,
    runId: testResult.summary.testRunId
  }));
  if (testRowArray.length > 0) {
    return formatTable(
      testRowArray,
      [
        {
          key: 'name',
          label: messages.testSetupMethodNameColHeader
        },
        { key: 'time', label: messages.setupTimeColHeader }
      ],
<<<<<<< HEAD
      messages.testSetupResultsHeader.replace('runId', testRowArray[0].runId)
=======
      messages.testSetupResultsHeader.replace('runId', testRowArray[0].runId),
      lineEnding
>>>>>>> origin/sm/W-23839447
    );
  }
  return '';
};

<<<<<<< HEAD
const formatDetailedCov = (testResult: TestResult, concise: boolean, showCategory: boolean): string => {
=======
const formatDetailedCov = (
  testResult: TestResult,
  concise: boolean,
  showCategory: boolean,
  lineEnding: string
): string => {
>>>>>>> origin/sm/W-23839447
  const testRowArray: Row[] = testResult.tests
    .filter((elem: ApexTestResultData) => !concise || elem.outcome === 'Fail' || elem.outcome === 'CompileFail')
    .flatMap(elem => {
      const base = {
        name: elem.fullName,
        ...(showCategory && { category: elem.category }),
        outcome: elem.outcome,
        msg: buildMsg(elem),
        runtime: `${elem.runTime}`
      };
      if (elem.perClassCoverage) {
        return elem.perClassCoverage.map(perClassCov => ({
          ...base,
          coveredClassName: perClassCov.apexClassOrTriggerName,
          coveredClassPercentage: perClassCov.percentage
        }));
      }
      return [
        {
          ...base,
          coveredClassName: '',
          coveredClassPercentage: ''
        }
      ];
    });

  if (testRowArray.length > 0) {
    return formatTable(
      testRowArray,
      [
        {
          key: 'name',
          label: messages.testNameColHeader
        },
        {
          key: 'coveredClassName',
          label: messages.classTestedHeader
        },
        ...(showCategory ? [{ key: 'category', label: messages.categoryColHeader }] : []),
        {
          key: 'outcome',
          label: messages.outcomeColHeader
        },
        {
          key: 'coveredClassPercentage',
          label: messages.percentColHeader
        },
        { key: 'msg', label: messages.msgColHeader },
        { key: 'runtime', label: messages.runtimeColHeader }
      ],
<<<<<<< HEAD
      messages.detailedCodeCovHeader.replace('%s', () => testResult.summary.testRunId)
=======
      messages.detailedCodeCovHeader.replace('%s', () => testResult.summary.testRunId),
      lineEnding
>>>>>>> origin/sm/W-23839447
    );
  }
  return '';
};

<<<<<<< HEAD
const formatCodeCov = (codeCoverages: CodeCoverageResult[]): string => {
=======
const formatCodeCov = (codeCoverages: CodeCoverageResult[], lineEnding: string): string => {
>>>>>>> origin/sm/W-23839447
  const codeCovRowArray: Row[] = codeCoverages.map(elem => ({
    name: elem.name,
    percent: elem.percentage,
    uncoveredLines: formatUncoveredLines(elem.uncoveredLines)
  }));

  return formatTable(
    codeCovRowArray,
    [
      {
        key: 'name',
        label: messages.classesColHeader
      },
      {
        key: 'percent',
        label: messages.percentColHeader
      },
      {
        key: 'uncoveredLines',
        label: messages.uncoveredLinesColHeader
      }
    ],
<<<<<<< HEAD
    messages.codeCovHeader
=======
    messages.codeCovHeader,
    lineEnding
>>>>>>> origin/sm/W-23839447
  );
};

const buildMsg = (elem: ApexTestResultData): string =>
  elem.stackTrace ? `${elem.message}\n${elem.stackTrace}` : (elem.message ?? '');

const formatUncoveredLines = (uncoveredLines: number[]): string =>
  uncoveredLines
    .slice(0, UNCOVERED_LINES_ARRAY_LIMIT)
    .map(line => line.toString())
    .concat(uncoveredLines.length > UNCOVERED_LINES_ARRAY_LIMIT ? ['...'] : [])
    .join(',');
