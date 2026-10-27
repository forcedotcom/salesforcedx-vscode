/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Row } from '../utils/types';
import { messages } from '../i18n/i18n';
import { type ApexTestResultData, type CodeCoverageResult, type TestResult } from '../tests/types';
import { formatTable } from '../utils/formatTable';

const UNCOVERED_LINES_ARRAY_LIMIT = 5;

export const formatHuman = (
  testResult: TestResult,
  detailedCoverage: boolean,
  concise: boolean = false,
  showCategory: boolean = false,
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
    messages.testSummaryHeader
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
      messages.testResultsHeader
    );
  }
  return '';
};

const formatSetup = (testResult: TestResult): string => {
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
      messages.testSetupResultsHeader.replace('runId', testRowArray[0].runId)
    );
  }
  return '';
};

const formatDetailedCov = (testResult: TestResult, concise: boolean, showCategory: boolean): string => {
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
      messages.detailedCodeCovHeader.replace('%s', () => testResult.summary.testRunId)
    );
  }
  return '';
};

const formatCodeCov = (codeCoverages: CodeCoverageResult[]): string => {
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
    messages.codeCovHeader
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
