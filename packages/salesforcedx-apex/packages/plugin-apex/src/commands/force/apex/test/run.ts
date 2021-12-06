/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancellationTokenSource,
  TapReporter,
  TestService,
  JUnitReporter,
  HumanReporter,
  TestResult,
  TestLevel,
  ApexTestRunResultStatus,
  TestRunIdResult
} from '@salesforce/apex-node';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import {
  buildOutputDirConfig,
  CliJsonFormat,
  JsonReporter
} from '../../../../reporters';
import {
  buildDescription,
  logLevels,
  resultFormat,
  FAILURE_EXIT_CODE
} from '../../../../utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'run');

export const TestLevelValues = [
  'RunLocalTests',
  'RunAllTestsInOrg',
  'RunSpecifiedTests'
];
export default class Run extends SfdxCommand {
  protected static requiresUsername = true;
  protected cancellationTokenSource = new CancellationTokenSource();

  public static description = buildDescription(
    messages.getMessage('commandDescription'),
    messages.getMessage('longDescription')
  );

  public static longDescription = messages.getMessage('longDescription');
  public static examples = [
    `$ sfdx force:apex:test:run`,
    `$ sfdx force:apex:test:run -n "MyClassTest,MyOtherClassTest" -r human`,
    `$ sfdx force:apex:test:run -s "MySuite,MyOtherSuite" -c -v --json`,
    `$ sfdx force:apex:test:run -t "MyClassTest.testCoolFeature,MyClassTest.testAwesomeFeature,AnotherClassTest,namespace.TheirClassTest.testThis" -r human`,
    `$ sfdx force:apex:test:run -l RunLocalTests -d <path to outputdir> -u me@my.org`
  ];

  public static readonly flagsConfig = {
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
      options: TestLevelValues
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
    await this.validateFlags();
    if (this.flags.outputdir) {
      this.ux.warn(messages.getMessage('warningMessage'));
    }

    // W-9346875 - default to human-readable result format for --wait flag
    if (
      this.flags.hasOwnProperty('wait') &&
      !this.flags.hasOwnProperty('resultformat')
    ) {
      this.flags.resultformat = 'human';
    }

    // add listener for errors
    process.on('uncaughtException', err => {
      const formattedErr = this.formatError(
        new SfdxError(messages.getMessage('apexLibErr', [err.message]))
      );
      this.ux.error(...formattedErr);
      process.exit();
    });

    // graceful shutdown
    const exitHandler = async (): Promise<void> => {
      await this.cancellationTokenSource.asyncCancel();
      process.exit();
    };

    process.on('SIGINT', exitHandler);
    process.on('SIGTERM', exitHandler);

    const testLevel = this.getTestLevelfromFlags();

    // org is guaranteed by requiresUsername field
    const conn = this.org!.getConnection();
    const testService = new TestService(conn);
    let result: TestResult | TestRunIdResult;

    // NOTE: This is a *bug*. Synchronous test runs should throw an error when multiple test classes are specified
    // This was re-introduced due to https://github.com/forcedotcom/salesforcedx-vscode/issues/3154
    // Address with W-9163533
    if (this.flags.synchronous && testLevel === TestLevel.RunSpecifiedTests) {
      const payload = await testService.buildSyncPayload(
        testLevel,
        this.flags.tests,
        this.flags.classnames
      );
      result = (await testService.runTestSynchronous(
        payload,
        this.flags.codecoverage,
        this.cancellationTokenSource.token
      )) as TestResult;
    } else {
      const payload = await testService.buildAsyncPayload(
        testLevel,
        this.flags.tests,
        this.flags.classnames,
        this.flags.suitenames
      );
      const reporter = undefined;
      if (this.flags.resultformat !== undefined) {
        result = await testService.runTestAsynchronous(
          payload,
          this.flags.codecoverage,
          false,
          reporter,
          this.cancellationTokenSource.token
        );
      } else {
        result = await testService.runTestAsynchronous(
          payload,
          this.flags.codecoverage,
          true,
          reporter,
          this.cancellationTokenSource.token
        );
      }
    }

    if (this.cancellationTokenSource.token.isCancellationRequested) {
      return null;
    }

    if (this.flags.outputdir) {
      const jsonOutput = this.formatResultInJson(result);
      const outputDirConfig = buildOutputDirConfig(
        result,
        jsonOutput,
        this.flags.outputdir,
        this.flags.resultformat,
        this.flags.detailedcoverage,
        this.flags.synchronous
      );

      await testService.writeResultFiles(
        result,
        outputDirConfig,
        this.flags.codecoverage
      );
    }

    try {
      if (
        result.hasOwnProperty('summary') &&
        (result as TestResult).summary.outcome ===
          ApexTestRunResultStatus.Failed
      ) {
        process.exitCode = FAILURE_EXIT_CODE;
      }
      switch (this.flags.resultformat) {
        case 'human':
          this.logHuman(
            result as TestResult,
            this.flags.detailedcoverage,
            this.flags.outputdir
          );
          break;
        case 'tap':
          this.logTap(result as TestResult);
          break;
        case 'junit':
          this.logJUnit(result as TestResult);
          break;
        case 'json':
          // when --json flag is specified, we should log CLI json format
          if (!this.flags.json) {
            this.ux.logJson({
              status: process.exitCode,
              result: this.formatResultInJson(result)
            });
          }
          break;
        default:
          if (this.flags.synchronous) {
            this.logHuman(
              result as TestResult,
              this.flags.detailedcoverage,
              this.flags.outputdir
            );
          } else {
            const id = (result as TestRunIdResult).testRunId;
            this.ux.log(
              messages.getMessage('runTestReportCommand', [
                id,
                this.org!.getUsername()
              ])
            );
          }
      }
    } catch (e) {
      this.ux.logJson(result);
      const msg = messages.getMessage('testResultProcessErr', [e]);
      this.ux.error(msg);
    }

    return this.formatResultInJson(result) as AnyJson;
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

  private getTestLevelfromFlags(): TestLevel {
    let testLevel: TestLevel;
    if (this.flags.testlevel) {
      testLevel = this.flags.testlevel;
    } else if (
      this.flags.classnames ||
      this.flags.suitenames ||
      this.flags.tests
    ) {
      testLevel = TestLevel.RunSpecifiedTests;
    } else {
      testLevel = TestLevel.RunLocalTests;
    }

    return testLevel;
  }

  private logHuman(
    result: TestResult,
    detailedCoverage: boolean,
    outputDir: string
  ): void {
    if (outputDir) {
      this.ux.log(messages.getMessage('outputDirHint', [outputDir]));
    }
    const humanReporter = new HumanReporter();
    const output = humanReporter.format(result, detailedCoverage);
    this.ux.log(output);
  }

  private logTap(result: TestResult): void {
    const reporter = new TapReporter();
    const hint = this.formatReportHint(result);
    this.ux.log(reporter.format(result, [hint]));
  }

  private logJUnit(result: TestResult): void {
    const reporter = new JUnitReporter();
    this.ux.log(reporter.format(result));
  }

  private formatResultInJson(
    result: TestResult | TestRunIdResult
  ): CliJsonFormat | TestRunIdResult {
    try {
      const reporter = new JsonReporter();
      return result.hasOwnProperty('summary')
        ? reporter.format(result as TestResult)
        : (result as TestRunIdResult);
    } catch (e) {
      this.ux.logJson(result);
      const msg = messages.getMessage('testResultProcessErr', [e]);
      this.ux.error(msg);
      throw e;
    }
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
