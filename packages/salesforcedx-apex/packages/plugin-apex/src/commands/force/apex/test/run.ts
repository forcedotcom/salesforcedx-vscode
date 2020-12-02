/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TapReporter, TestService, JUnitReporter } from '@salesforce/apex-node';
import {
  AsyncTestConfiguration,
  AsyncTestArrayConfiguration,
  SyncTestConfiguration,
  TestItem,
  TestResult
} from '@salesforce/apex-node/lib/src/tests/types';
import { Row, Table } from '@salesforce/apex-node/lib/src/utils';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, Org } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { JsonReporter } from '../../../../jsonReporter';
import { buildDescription, logLevels } from '../../../../utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'run');

export const TestLevel = [
  'RunLocalTests',
  'RunAllTestsInOrg',
  'RunSpecifiedTests'
];

export const resultFormat = ['human', 'tap', 'junit', 'json'];

const CLASS_ID_PREFIX = '01p';

export function buildTestItem(testNames: string): TestItem[] {
  const testNameArray = testNames.split(',');
  const tItems = testNameArray.map(item => {
    if (item.indexOf('.') > 0) {
      const splitItemData = item.split('.');
      return {
        className: splitItemData[0],
        testMethods: [splitItemData[1]]
      } as TestItem;
    }

    return { className: item } as TestItem;
  });
  return tItems;
}

export default class Run extends SfdxCommand {
  protected static requiresUsername = true;
  // Guaranteed by requires username
  protected org!: Org;

  public static description = buildDescription(
    messages.getMessage('commandDescription'),
    messages.getMessage('longDescription')
  );

  public static longDescription = messages.getMessage('longDescription');
  public static examples = [
    `$ sfdx force:apex:test:run`,
    `$ sfdx force:apex:test:run -n "MyClassTest,MyOtherClassTest" -r human`,
    `$ sfdx force:apex:test:run -s "MySuite,MyOtherSuite" -c --json`,
    `$ sfdx force:apex:test:run -t "MyClassTest.testCoolFeature,MyClassTest.testAwesomeFeature,AnotherClassTest,namespace.TheirClassTest.testThis" -r human`,
    `$ sfdx force:apex:test:run -l RunLocalTests -d <path to outputdir> -u me@my.org`
  ];

  protected static flagsConfig = {
    json: flags.boolean({
      description: messages.getMessage('jsonDescription')
    }),
    loglevel: flags.enum({
      description: messages.getMessage('logLevelDescription'),
      longDescription: messages.getMessage('logLevelLongDescription'),
      default: 'warn',
      options: logLevels
    }),
    apiversion: flags.builtin(),
    codecoverage: flags.boolean({
      char: 'c',
      description: messages.getMessage('codeCoverageDescription')
    }),
    outputdir: flags.string({
      char: 'd',
      description: messages.getMessage('outputDirectoryDescription')
    }),
    testlevel: flags.enum({
      char: 'l',
      description: messages.getMessage('testLevelDescription'),
      options: TestLevel
    }),
    classnames: flags.string({
      char: 'n',
      description: messages.getMessage('classNamesDescription')
    }),
    resultformat: flags.enum({
      char: 'r',
      description: messages.getMessage('resultFormatLongDescription'),
      options: resultFormat
    }),
    suitenames: flags.string({
      char: 's',
      description: messages.getMessage('suiteNamesDescription')
    }),
    tests: flags.string({
      char: 't',
      description: messages.getMessage('testsDescription')
    }),
    wait: flags.string({
      char: 'w',
      description: messages.getMessage('waitDescription')
    }),
    synchronous: flags.boolean({
      char: 'y',
      description: messages.getMessage('synchronousDescription')
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verboseDescription')
    }),
    detailedcoverage: flags.boolean({
      char: 'v',
      description: messages.getMessage('detailedCoverageDescription'),
      dependsOn: ['codecoverage']
    })
  };

  public async run(): Promise<AnyJson> {
    try {
      await this.validateFlags();
      const testLevel = this.flags.testlevel
        ? this.flags.testlevel
        : 'RunSpecifiedTests';

      const conn = this.org.getConnection();
      const testService = new TestService(conn);
      let result: TestResult;

      if (this.flags.synchronous) {
        let testOptions: SyncTestConfiguration;
        if (this.flags.tests) {
          testOptions = {
            tests: buildTestItem(this.flags.tests),
            testLevel
          };

          const classes = testOptions.tests?.map(testItem => {
            if (testItem.className) {
              return testItem.className;
            }
          });
          if (new Set(classes).size !== 1) {
            return Promise.reject(
              new Error(messages.getMessage('syncClassErr'))
            );
          }
        } else {
          const prop = this.flags.classnames
            .toLowerCase()
            .startsWith(CLASS_ID_PREFIX)
            ? 'classId'
            : 'className';
          testOptions = {
            tests: [{ [prop]: this.flags.classnames }],
            testLevel
          };
        }

        result = await testService.runTestSynchronous(
          testOptions,
          this.flags.codecoverage
        );
      } else {
        let payload: AsyncTestConfiguration | AsyncTestArrayConfiguration;

        if (this.flags.tests) {
          payload = {
            tests: buildTestItem(this.flags.tests),
            testLevel
          };
        } else {
          payload = {
            classNames: this.flags.classnames,
            suiteNames: this.flags.suitenames,
            testLevel
          };
        }

        result = await testService.runTestAsynchronous(
          payload,
          this.flags.codecoverage
        );
      }

      switch (this.flags.resultformat) {
        case 'human':
          this.ux.log(this.formatHuman(result, this.flags.detailedcoverage));
          break;
        case 'tap':
          this.logTap(result);
          break;
        case 'junit':
          this.logJUnit(result);
          break;
        default:
          const id = result.summary.testRunId;
          const username = result.summary.username;
          this.ux.log(
            messages.getMessage('runTestReportCommand', [id, username])
          );
      }

      return this.logJson(result);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public async validateFlags(): Promise<void> {
    if (this.flags.codecoverage && !this.flags.resultformat) {
      return Promise.reject(
        new Error(messages.getMessage('missingReporterErr'))
      );
    }

    if (
      (this.flags.classnames && (this.flags.suitenames || this.flags.tests)) ||
      (this.flags.suitenames && this.flags.tests)
    ) {
      return Promise.reject(
        new Error(messages.getMessage('classSuiteTestErr'))
      );
    }

    if (
      this.flags.synchronous &&
      (this.flags.suitenames ||
        (this.flags.classnames && this.flags.classnames.split(',').length > 1))
    ) {
      return Promise.reject(new Error(messages.getMessage('syncClassErr')));
    }

    if (
      (this.flags.tests || this.flags.classnames || this.flags.suitenames) &&
      this.flags.testlevel &&
      this.flags.testlevel !== 'RunSpecifiedTests'
    ) {
      return Promise.reject(new Error(messages.getMessage('testLevelErr')));
    }
  }

  public formatHuman(
    testResult: TestResult,
    detailedCoverage: boolean
  ): string {
    const tb = new Table();

    // Summary Table
    const summaryRowArray: Row[] = [
      {
        name: messages.getMessage('outcome'),
        value: testResult.summary.outcome
      },
      {
        name: messages.getMessage('testsRan'),
        value: String(testResult.summary.testsRan)
      },
      {
        name: messages.getMessage('passRate'),
        value: testResult.summary.passRate
      },
      {
        name: messages.getMessage('failRate'),
        value: testResult.summary.failRate
      },
      {
        name: messages.getMessage('skipRate'),
        value: testResult.summary.skipRate
      },
      {
        name: messages.getMessage('testRunId'),
        value: testResult.summary.testRunId
      },
      {
        name: messages.getMessage('testExecutionTime'),
        value: `${testResult.summary.testExecutionTimeInMs} ms`
      },
      {
        name: messages.getMessage('orgId'),
        value: testResult.summary.orgId
      },
      {
        name: messages.getMessage('username'),
        value: testResult.summary.username
      },
      ...(testResult.summary.orgWideCoverage
        ? [
            {
              name: messages.getMessage('orgWideCoverage'),
              value: String(testResult.summary.orgWideCoverage)
            }
          ]
        : [])
    ];

    let tbResult = tb.createTable(
      summaryRowArray,
      [
        {
          key: 'name',
          label: messages.getMessage('name_col_header')
        },
        { key: 'value', label: messages.getMessage('value_col_header') }
      ],
      messages.getMessage('test_summary_header')
    );

    // Test Result Table
    if (!detailedCoverage) {
      const testRowArray: Row[] = [];
      testResult.tests.forEach(
        (elem: {
          fullName: string;
          outcome: string;
          message: string | null;
          runTime: number;
        }) => {
          testRowArray.push({
            name: elem.fullName,
            outcome: elem.outcome,
            msg: elem.message ? elem.message : '',
            runtime: `${elem.runTime}`
          });
        }
      );

      tbResult += '\n\n';
      tbResult += tb.createTable(
        testRowArray,
        [
          {
            key: 'name',
            label: messages.getMessage('test_name_col_header')
          },
          { key: 'outcome', label: messages.getMessage('outcome_col_header') },
          { key: 'msg', label: messages.getMessage('msg_col_header') },
          { key: 'runtime', label: messages.getMessage('runtime_col_header') }
        ],
        messages.getMessage('test_results_header')
      );
    }
    // Code coverage
    if (testResult.codecoverage) {
      if (detailedCoverage) {
        const testRowArray: Row[] = [];
        testResult.tests.forEach(
          (elem: {
            fullName: string;
            outcome: string;
            perTestCoverage?: {
              apexClassOrTriggerName: string;
              percentage: string;
            };
            message: string | null;
            runTime: number;
          }) => {
            testRowArray.push({
              name: elem.fullName,
              coveredClassName: elem.perTestCoverage
                ? elem.perTestCoverage.apexClassOrTriggerName
                : '',
              outcome: elem.outcome,
              coveredClassPercentage: elem.perTestCoverage
                ? elem.perTestCoverage.percentage
                : '',
              msg: elem.message ? elem.message : '',
              runtime: `${elem.runTime}`
            });
          }
        );

        tbResult += '\n\n';
        tbResult += tb.createTable(
          testRowArray,
          [
            {
              key: 'name',
              label: messages.getMessage('test_name_col_header')
            },
            {
              key: 'coveredClassName',
              label: messages.getMessage('class_tested_header')
            },
            {
              key: 'outcome',
              label: messages.getMessage('outcome_col_header')
            },
            {
              key: 'coveredClassPercentage',
              label: messages.getMessage('percent_col_header')
            },
            { key: 'msg', label: messages.getMessage('msg_col_header') },
            { key: 'runtime', label: messages.getMessage('runtime_col_header') }
          ],
          messages.getMessage('detailed_code_cov_header', [
            testResult.summary.testRunId
          ])
        );
      }
      const codeCovRowArray: Row[] = [];
      testResult.codecoverage.forEach(
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

      tbResult += '\n\n';
      tbResult += tb.createTable(
        codeCovRowArray,
        [
          {
            key: 'name',
            label: messages.getMessage('classes_col_header')
          },
          {
            key: 'percent',
            label: messages.getMessage('percent_col_header')
          },
          {
            key: 'uncoveredLines',
            label: messages.getMessage('uncovered_lines_col_header')
          }
        ],
        messages.getMessage('code_cov_header')
      );
    }
    return tbResult;
  }

  public formatUncoveredLines(uncoveredLines: number[]): string {
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

  private logTap(result: TestResult): void {
    try {
      const reporter = new TapReporter();
      const hint = this.formatReportHint(result);
      this.ux.log(reporter.format(result, [hint]));
    } catch (err) {
      this.ux.logJson(result);
      const msg = messages.getMessage('testResultProcessErr', [err]);
      this.ux.error(msg);
    }
  }

  private logJUnit(result: TestResult): void {
    try {
      const reporter = new JUnitReporter();
      this.ux.log(reporter.format(result));
    } catch (e) {
      this.ux.logJson(result);
      const msg = messages.getMessage('testResultProcessErr', [e]);
      this.ux.error(msg);
    }
  }

  private logJson(result: TestResult): AnyJson {
    try {
      const reporter = new JsonReporter();
      return reporter.format(result);
    } catch (e) {
      this.ux.logJson(result);
      const msg = messages.getMessage('testResultProcessErr', [e]);
      this.ux.error(msg);
    }
    return result;
  }

  private formatReportHint(result: TestResult): string {
    let reportArgs = `-i ${result.summary.testRunId}`;
    if (this.flags.targetusername) {
      reportArgs += ` -u ${this.flags.targetusername}`;
    }
    const hint = messages.getMessage('apexTestReportFormatHint', [reportArgs]);
    return hint;
  }
}
