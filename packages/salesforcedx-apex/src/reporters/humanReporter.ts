/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { elapsedTime, HeapMonitor, Row, Table } from '../utils';
import {
  ApexTestResultData,
  ApexTestResultOutcome,
  CodeCoverageResult,
  TestResult
} from '../tests';
import { nls } from '../i18n';
import * as os from 'node:os';

const UNCOVERED_LINES_ARRAY_LIMIT = 5;

export class HumanReporter {
  @elapsedTime()
  public format(
    testResult: TestResult,
    detailedCoverage: boolean,
    concise: boolean = false
  ): string {
    HeapMonitor.getInstance().checkHeapSize('HumanReporter.format');
    try {
      return [
        ...(!testResult.codecoverage || !detailedCoverage
          ? [this.formatTestResults(testResult.tests, concise)]
          : []),
        ...(testResult.codecoverage && detailedCoverage
          ? [this.formatDetailedCov(testResult, concise)]
          : []),
        ...(testResult.codecoverage && !concise
          ? [this.formatCodeCov(testResult.codecoverage)]
          : []),
        ...(testResult.setup && !concise ? [this.formatSetup(testResult)] : []),
        this.formatSummary(testResult)
      ].join(os.EOL.repeat(2));
    } finally {
      HeapMonitor.getInstance().checkHeapSize('HumanReporter.format');
    }
  }

  @elapsedTime()
  private formatSummary(testResult: TestResult): string {
    // Summary Table
    const summaryRowArray: Row[] = [
      {
        name: nls.localize('outcome'),
        value: testResult.summary.outcome
      },
      {
        name: nls.localize('testsRan'),
        value: String(testResult.summary.testsRan)
      },
      {
        name: nls.localize('passRate'),
        value: testResult.summary.passRate
      },
      {
        name: nls.localize('failRate'),
        value: testResult.summary.failRate
      },
      {
        name: nls.localize('skipRate'),
        value: testResult.summary.skipRate
      },
      {
        name: nls.localize('testRunId'),
        value: testResult.summary.testRunId
      },
      {
        name: nls.localize('testSetupTime'),
        value: `${testResult.summary.testSetupTimeInMs || 0} ms`
      },
      {
        name: nls.localize('testExecutionTime'),
        value: `${testResult.summary.testExecutionTimeInMs} ms`
      },
      {
        name: nls.localize('testTotalTime'),
        value: `${testResult.summary.testTotalTimeInMs} ms`
      },
      {
        name: nls.localize('orgId'),
        value: testResult.summary.orgId
      },
      {
        name: nls.localize('username'),
        value: testResult.summary.username
      },
      ...(testResult.summary.orgWideCoverage
        ? [
            {
              name: nls.localize('orgWideCoverage'),
              value: String(testResult.summary.orgWideCoverage)
            }
          ]
        : [])
    ];

    return new Table().createTable(
      summaryRowArray,
      [
        {
          key: 'name',
          label: nls.localize('nameColHeader')
        },
        { key: 'value', label: nls.localize('valueColHeader') }
      ],
      nls.localize('testSummaryHeader')
    );
  }

  @elapsedTime()
  private formatTestResults(
    tests: ApexTestResultData[],
    concise: boolean
  ): string {
    const testRowArray: Row[] = tests
      .filter(
        (elem) =>
          !concise ||
          elem.outcome === ApexTestResultOutcome.Fail ||
          elem.outcome === ApexTestResultOutcome.CompileFail
      )
      .map((elem) => ({
        name: elem.fullName,
        outcome: elem.outcome,
        msg: buildMsg(elem),
        runtime:
          elem.outcome !== ApexTestResultOutcome.Fail ? `${elem.runTime}` : ''
      }));

    if (testRowArray.length > 0) {
      return new Table().createTable(
        testRowArray,
        [
          {
            key: 'name',
            label: nls.localize('testNameColHeader')
          },
          { key: 'outcome', label: nls.localize('outcomeColHeader') },
          { key: 'msg', label: nls.localize('msgColHeader') },
          { key: 'runtime', label: nls.localize('runtimeColHeader') }
        ],
        nls.localize('testResultsHeader')
      );
    }
    return '';
  }

  @elapsedTime()
  private formatSetup(testResult: TestResult): string {
    const testRowArray: Row[] = testResult.setup.map((elem) => ({
      name: elem.fullName,
      time: `${elem.testSetupTime}`,
      runId: testResult.summary.testRunId
    }));
    if (testRowArray.length > 0) {
      return new Table().createTable(
        testRowArray,
        [
          {
            key: 'name',
            label: nls.localize('testSetupMethodNameColHeader')
          },
          { key: 'time', label: nls.localize('setupTimeColHeader') }
        ],
        nls
          .localize('testSetupResultsHeader')
          .replace('runId', testRowArray[0].runId)
      );
    }
    return '';
  }

  @elapsedTime()
  private formatDetailedCov(testResult: TestResult, concise: boolean): string {
    const testRowArray: Row[] = testResult.tests
      .filter(
        (elem: ApexTestResultData) =>
          !concise ||
          elem.outcome === ApexTestResultOutcome.Fail ||
          elem.outcome === ApexTestResultOutcome.CompileFail
      )
      .flatMap((elem) => {
        const base = {
          name: elem.fullName,
          outcome: elem.outcome,
          msg: buildMsg(elem),
          runtime: `${elem.runTime}`
        };
        if (elem.perClassCoverage) {
          return elem.perClassCoverage.map((perClassCov) => ({
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
      return new Table().createTable(
        testRowArray,
        [
          {
            key: 'name',
            label: nls.localize('testNameColHeader')
          },
          {
            key: 'coveredClassName',
            label: nls.localize('classTestedHeader')
          },
          {
            key: 'outcome',
            label: nls.localize('outcomeColHeader')
          },
          {
            key: 'coveredClassPercentage',
            label: nls.localize('percentColHeader')
          },
          { key: 'msg', label: nls.localize('msgColHeader') },
          { key: 'runtime', label: nls.localize('runtimeColHeader') }
        ],
        nls.localize('detailedCodeCovHeader', [testResult.summary.testRunId])
      );
    }
    return '';
  }

  @elapsedTime()
  private formatCodeCov(codeCoverages: CodeCoverageResult[]): string {
    const codeCovRowArray: Row[] = codeCoverages.map((elem) => ({
      name: elem.name,
      percent: elem.percentage,
      uncoveredLines: formatUncoveredLines(elem.uncoveredLines)
    }));

    return new Table().createTable(
      codeCovRowArray,
      [
        {
          key: 'name',
          label: nls.localize('classesColHeader')
        },
        {
          key: 'percent',
          label: nls.localize('percentColHeader')
        },
        {
          key: 'uncoveredLines',
          label: nls.localize('uncoveredLinesColHeader')
        }
      ],
      nls.localize('codeCovHeader')
    );
  }
}

const buildMsg = (elem: ApexTestResultData): string =>
  elem.stackTrace
    ? `${elem.message}\n${elem.stackTrace}`
    : (elem.message ?? '');

const formatUncoveredLines = (uncoveredLines: number[]): string =>
  uncoveredLines.length === 0
    ? ''
    : uncoveredLines
        .slice(0, Math.min(uncoveredLines.length, UNCOVERED_LINES_ARRAY_LIMIT))
        .map((line) => line.toString())
        .concat(
          uncoveredLines.length > UNCOVERED_LINES_ARRAY_LIMIT ? ['...'] : []
        )
        .join(',');
