/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Row, TableWriteableStream } from '../utils/tableWritableStream';
import {
  ApexTestResultData,
  ApexTestResultOutcome,
  TestResult
} from '../tests';
import { nls } from '../i18n';
import { Readable, ReadableOptions } from 'node:stream';
import { elapsedTime } from '../utils';
import { LoggerLevel } from '@salesforce/core';
import { EOL } from 'os';

export class HumanFormatTransform extends Readable {
  constructor(
    private readonly testResult: TestResult,
    private readonly detailedCoverage: boolean,
    options?: ReadableOptions
  ) {
    super(options);
    this.testResult = testResult;
    this.detailedCoverage ??= false;
  }

  _read(): void {
    this.format();
    this.push(null); // Indicates end of data
  }

  @elapsedTime()
  public format(): void {
    this.formatSummary();
    if (!this.testResult.codecoverage || !this.detailedCoverage) {
      this.formatTestResults();
    }

    if (this.testResult.codecoverage) {
      if (this.detailedCoverage) {
        this.formatDetailedCov();
      }
      this.formatCodeCov();
    }
  }

  @elapsedTime()
  private formatSummary(): void {
    const tb = new TableWriteableStream(this);

    // Summary Table
    const summaryRowArray: Row[] = [
      {
        name: nls.localize('outcome'),
        value: this.testResult.summary.outcome
      },
      {
        name: nls.localize('testsRan'),
        value: String(this.testResult.summary.testsRan)
      },
      {
        name: nls.localize('passRate'),
        value: this.testResult.summary.passRate
      },
      {
        name: nls.localize('failRate'),
        value: this.testResult.summary.failRate
      },
      {
        name: nls.localize('skipRate'),
        value: this.testResult.summary.skipRate
      },
      {
        name: nls.localize('testRunId'),
        value: this.testResult.summary.testRunId
      },
      {
        name: nls.localize('testExecutionTime'),
        value: `${this.testResult.summary.testExecutionTimeInMs} ms`
      },
      {
        name: nls.localize('orgId'),
        value: this.testResult.summary.orgId
      },
      {
        name: nls.localize('username'),
        value: this.testResult.summary.username
      },
      ...(this.testResult.summary.orgWideCoverage
        ? [
            {
              name: nls.localize('orgWideCoverage'),
              value: String(this.testResult.summary.orgWideCoverage)
            }
          ]
        : [])
    ];

    tb.createTable(
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
  private formatTestResults(): void {
    const tb = new TableWriteableStream(this);
    const testRowArray: Row[] = [];
    this.testResult.tests.forEach(
      (elem: {
        fullName: string;
        outcome: ApexTestResultOutcome;
        message: string | null;
        runTime: number;
        stackTrace: string | null;
      }) => {
        const msg = elem.stackTrace
          ? `${elem.message}\n${elem.stackTrace}`
          : elem.message;

        testRowArray.push({
          name: elem.fullName,
          outcome: elem.outcome,
          msg: elem.message ? msg : '',
          runtime:
            elem.outcome !== ApexTestResultOutcome.Fail ? `${elem.runTime}` : ''
        });
      }
    );

    this.push(`${EOL}${EOL}`);
    tb.createTable(
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

  @elapsedTime()
  private formatDetailedCov(): void {
    const tb = new TableWriteableStream(this);
    const testRowArray: Row[] = [];
    this.testResult.tests.forEach((elem: ApexTestResultData) => {
      const msg = elem.stackTrace
        ? `${elem.message}\n${elem.stackTrace}`
        : elem.message;

      if (elem.perClassCoverage) {
        elem.perClassCoverage.forEach((perClassCov) => {
          testRowArray.push({
            name: elem.fullName,
            coveredClassName: perClassCov.apexClassOrTriggerName,
            outcome: elem.outcome,
            coveredClassPercentage: perClassCov.percentage,
            msg: elem.message ? msg : '',
            runtime: `${elem.runTime}`
          });
        });
      } else {
        testRowArray.push({
          name: elem.fullName,
          coveredClassName: '',
          outcome: elem.outcome,
          coveredClassPercentage: '',
          msg: elem.message ? msg : '',
          runtime: `${elem.runTime}`
        });
      }
    });

    this.push('\n\n');
    tb.createTable(
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
      nls.localize('detailedCodeCovHeader', [this.testResult.summary.testRunId])
    );
  }

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private formatCodeCov(): void {
    const tb = new TableWriteableStream(this);
    const codeCovRowArray: Row[] = [];
    this.testResult.codecoverage.forEach(
      (elem: {
        name: string;
        percentage: string;
        uncoveredLines: number[];
      }) => {
        codeCovRowArray.push({
          name: elem.name,
          percent: elem.percentage,
          uncoveredLines: this.formatUncoveredLines(elem.uncoveredLines)
        });
      }
    );

    this.push('\n\n');
    tb.createTable(
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

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private formatUncoveredLines(uncoveredLines: number[]): string {
    const arrayLimit = 5;
    if (uncoveredLines.length === 0) {
      return '';
    }

    const limit =
      uncoveredLines.length > arrayLimit ? arrayLimit : uncoveredLines.length;
    let processedLines = uncoveredLines.slice(0, limit).join(',');
    if (uncoveredLines.length > arrayLimit) {
      processedLines += '...';
    }
    return processedLines;
  }
}
