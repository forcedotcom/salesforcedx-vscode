/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TapReporter,
  TestService,
  JUnitReporter,
  HumanReporter,
  TestResult
} from '@salesforce/apex-node';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, Org } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { CliJsonFormat, JsonReporter } from '../../../../reporters';
import { buildDescription, logLevels, resultFormat } from '../../../../utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'run');

export const TestLevel = [
  'RunLocalTests',
  'RunAllTestsInOrg',
  'RunSpecifiedTests'
];
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
    `$ sfdx force:apex:test:run -s "MySuite,MyOtherSuite" -c -v --json`,
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
    await this.validateFlags();
    const testLevel = this.flags.testlevel
      ? this.flags.testlevel
      : 'RunSpecifiedTests';

    const conn = this.org.getConnection();
    const testService = new TestService(conn);
    let result: TestResult;

    if (this.flags.synchronous) {
      const payload = await testService.buildSyncPayload(
        testLevel,
        this.flags.tests,
        this.flags.classnames
      );
      result = await testService.runTestSynchronous(
        payload,
        this.flags.codecoverage
      );
    } else {
      const payload = await testService.buildAsyncPayload(
        testLevel,
        this.flags.tests,
        this.flags.classnames,
        this.flags.suitenames
      );
      result = await testService.runTestAsynchronous(
        payload,
        this.flags.codecoverage
      );
    }

    if (this.flags.outputdir) {
      const jsonOutput = this.logJson(result);
      const outputDirConfig = {
        dirPath: this.flags.outputdir,
        fileInfos: [
          {
            filename: `test-result-${result.summary.testRunId}.json`,
            content: jsonOutput
          },
          ...(jsonOutput.coverage
            ? [
                {
                  filename: `test-result-codecoverage.json`,
                  content: jsonOutput.coverage.coverage
                }
              ]
            : [])
        ],
        ...(this.flags.resultformat === 'junit' ||
        this.flags.resultformat === 'tap'
          ? { resultFormat: this.flags.resultformat }
          : {})
      };

      await testService.writeResultFiles(
        result,
        outputDirConfig,
        this.flags.codecoverage
      );
    }

    try {
      switch (this.flags.resultformat) {
        case 'human':
          this.logHuman(
            result,
            this.flags.detailedcoverage,
            this.flags.outputdir
          );
          break;
        case 'tap':
          this.logTap(result);
          break;
        case 'junit':
          this.logJUnit(result);
          break;
        case 'json':
          this.ux.logJson(this.logJson(result));
          break;
        default:
          const id = result.summary.testRunId;
          const username = result.summary.username;
          this.ux.log(
            messages.getMessage('runTestReportCommand', [id, username])
          );
      }
    } catch (e) {
      this.ux.logJson(result);
      const msg = messages.getMessage('testResultProcessErr', [e]);
      this.ux.error(msg);
    }

    return this.logJson(result) as AnyJson;
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

  private logJson(result: TestResult): CliJsonFormat {
    try {
      const reporter = new JsonReporter();
      return reporter.format(result);
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
