/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  HumanReporter,
  JUnitReporter,
  ResultFormat,
  TestLevel,
  TestService
} from '@salesforce/apex-node';
import { expect, test } from '@salesforce/command/lib/test';
import { Messages, SfdxProject } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import {
  testRunSimple,
  runWithCoverage,
  cliJsonResult,
  cliWithCoverage,
  jsonResult,
  jsonWithCoverage,
  jsonSyncResult,
  rawSyncResult
} from './testData';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'run');

const SFDX_PROJECT_PATH = 'test-sfdx-project';
const TEST_USERNAME = 'test@example.com';
const projectPath = path.resolve(SFDX_PROJECT_PATH);
const sfdxProjectJson = {
  packageDirectories: [{ path: 'force-app', default: true }],
  namespace: '',
  sfdcLoginUrl: 'https://login.salesforce.com',
  sourceApiVersion: '49.0'
};

describe('force:apex:test:run', () => {
  let sandboxStub: SinonSandbox;

  beforeEach(async () => {
    sandboxStub = createSandbox();
    sandboxStub.stub(SfdxProject, 'resolve').returns(
      Promise.resolve(({
        getPath: () => projectPath,
        resolveProjectConfig: () => sfdxProjectJson
      } as unknown) as SfdxProject)
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'human'
    ])
    .it('should return a success human format message with async run', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.contain('Test Summary');
      expect(result).to.contain('Test Results');
      expect(result).to.not.contain('Apex Code Coverage by Class');
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'tap'
    ])
    .it('should return a success tap format message with async run', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.contain('1..1');
      expect(result).to.contain('ok 1 MyApexTests.testConfig');
      expect(result).to.contain('# Run "sfdx force:apex:test:report');
      expect(result).to.not.contain('Apex Code Coverage by Class');
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => ({ tests: [] }))
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'tap'
    ])
    .it('should handle a tap format parsing error', ctx => {
      expect(ctx.stdout).to.contain('{\n  "tests": []\n}\n');
      expect(ctx.stderr).to.contain(
        messages.getMessage('testResultProcessErr', [
          "TypeError: Cannot read property 'testRunId' of undefined"
        ])
      );
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'junit'
    ])
    .it('should return a success junit format message with async run', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.contain(
        '<testcase name="testConfig" classname="MyApexTests" time="0.05">'
      );
      expect(result).to.contain(`<property name="testsRan" value="1"/>`);
      expect(result).to.not.contain('# Run "sfdx force:apex:test:report');
      expect(result).to.not.contain('Apex Code Coverage by Class');
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => ({ tests: [] }))
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'junit'
    ])
    .it('should handle a junit format parsing error', ctx => {
      expect(ctx.stdout).to.contain('{\n  "tests": []\n}\n');
      expect(ctx.stderr).to.contain(
        messages.getMessage('testResultProcessErr', [
          "TypeError: Cannot read property 'testStartTime' of undefined"
        ])
      );
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'human',
      '--synchronous'
    ])
    .it('should return a success human format message with sync run', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.contain('Test Summary');
      expect(result).to.contain('Test Results');
      expect(result).to.not.contain('Apex Code Coverage by Class');
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests',
      '--resultformat',
      'tap',
      '--synchronous'
    ])
    .it('should return a success tap format message with sync run', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.contain('1..1');
      expect(result).to.contain('ok 1 MyApexTests.testConfig');
      expect(result).to.contain('# Run "sfdx force:apex:test:report');
      expect(result).to.not.contain('Apex Code Coverage by Class');
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testInsertRecord',
      '--resultformat',
      'junit',
      '--synchronous'
    ])
    .it('should return a success junit format message with sync run', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      expect(result).to.contain(
        '<testcase name="testConfig" classname="MyApexTests" time="0.05">'
      );
      expect(result).to.contain(`<property name="testsRan" value="1"/>`);
      expect(result).to.not.contain('# Run "sfdx force:apex:test:report');
      expect(result).to.not.contain('Apex Code Coverage by Class');
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testInsertRecord',
      '--resultformat',
      'json'
    ])
    .it(
      'should return a json result with json result format specified',
      ctx => {
        const result = ctx.stdout;
        expect(result).to.not.be.empty;
        const resultJSON = JSON.parse(result);
        expect(resultJSON).to.deep.equal(jsonResult);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testInsertRecord',
      '--resultformat',
      'json',
      '--json'
    ])
    .it(
      'should return a CLI json result when both json flag and json result flag are specified',
      ctx => {
        const result = ctx.stdout;
        expect(result).to.not.be.empty;
        const resultJSON = JSON.parse(result);
        expect(resultJSON).to.deep.equal(cliJsonResult);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testInsertRecord',
      '--json',
      '--resultformat',
      'junit',
      '--synchronous'
    ])
    .it('should return a success json result with sync run', ctx => {
      const result = ctx.stdout;
      expect(result).to.not.be.empty;
      const resultJSON = JSON.parse(result);
      expect(resultJSON).to.deep.equal(cliJsonResult);
    });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => runWithCoverage)
    .stdout()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testInsertRecord',
      '--json',
      '--resultformat',
      'junit',
      '-c'
    ])
    .it(
      'should return a success json result with async run and code coverage',
      ctx => {
        const result = ctx.stdout;
        expect(result).to.not.be.empty;
        const resultJSON = JSON.parse(result);
        expect(resultJSON).to.deep.equal(cliWithCoverage);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(
        TestService.prototype,
        'runTestSynchronous'
      );
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--classnames',
      'MyApexTests',
      '--synchronous'
    ])
    .it(
      'should format request with correct properties for sync run with class name',
      ctx => {
        expect(
          (ctx.myStub as SinonStub).calledWith({
            tests: [{ className: 'MyApexTests' }],
            testLevel: 'RunSpecifiedTests'
          })
        ).to.be.true;
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(
        TestService.prototype,
        'runTestSynchronous'
      );
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--classnames',
      '01p45678x123456',
      '--synchronous'
    ])
    .it(
      'should format request with correct properties for sync run with class id',
      ctx => {
        expect(
          (ctx.myStub as SinonStub).calledWith({
            tests: [{ classId: '01p45678x123456' }],
            testLevel: 'RunSpecifiedTests'
          })
        ).to.be.true;
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(
        TestService.prototype,
        'runTestSynchronous'
      );
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '--synchronous'
    ])
    .it(
      'should format request with correct properties for sync run with tests',
      ctx => {
        expect(
          (ctx.myStub as SinonStub).calledWith({
            tests: [
              {
                className: 'MyApexTests',
                testMethods: ['testMethodOne']
              }
            ],
            testLevel: 'RunSpecifiedTests'
          })
        ).to.be.true;
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(
        TestService.prototype,
        'runTestSynchronous'
      );
      ctx.mySpy = sandboxStub.spy(TestService.prototype, 'buildSyncPayload');
    })
    .stdout()
    .stderr()
    .command(['force:apex:test:run', '--synchronous'])
    .it(
      'should format request with correct properties for sync run with no tests or classname parameters specified',
      ctx => {
        expect((ctx.mySpy as SinonSpy).calledWith(TestLevel.RunLocalTests)).to
          .be.true;
        expect(ctx.stderr).to.contain(
          'Specify a test class or test methods when running tests synchronously'
        );
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .do(ctx => {
      ctx.myStub = sandboxStub
        .stub(TestService.prototype, 'runTestAsynchronous')
        // @ts-ignore
        .resolves(testRunSimple);
      ctx.mySpy = sandboxStub.spy(TestService.prototype, 'buildAsyncPayload');
    })
    .stdout()
    .stderr()
    .command(['force:apex:test:run'])
    .it(
      'should format request with correct properties and display correct info for async run with no tests or classname parameters specified',
      ctx => {
        expect((ctx.mySpy as SinonSpy).calledWith(TestLevel.RunLocalTests)).to
          .be.true;
        expect(ctx.stdout).to.not.be.empty;
        expect(ctx.stdout).to.contain('Run "sfdx force:apex:test:report');
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stub(fs, 'existsSync', () => true)
    .stub(fs, 'mkdirSync', () => true)
    .stub(fs, 'createWriteStream', () => new stream.PassThrough())
    .stub(fs, 'openSync', () => 10)
    .stub(fs, 'closeSync', () => true)
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir',
      '--resultformat',
      'human'
    ])
    .it(
      'should output correct message when output directory is specified with human result format',
      ctx => {
        expect(ctx.stdout).to.contain(
          messages.getMessage('outputDirHint', ['path/to/dir'])
        );
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestSynchronous', () => rawSyncResult)
    .stub(fs, 'existsSync', () => true)
    .stub(fs, 'mkdirSync', () => true)
    .stub(fs, 'createWriteStream', () => new stream.PassThrough())
    .stub(fs, 'openSync', () => 10)
    .stub(fs, 'closeSync', () => true)
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir',
      '-y'
    ])
    .it(
      'should output human-readable result for synchronous test run with no result format specified',
      ctx => {
        expect(ctx.stdout).to.contain(
          messages.getMessage('outputDirHint', ['path/to/dir'])
        );
        expect(ctx.stdout).to.contain(
          // @ts-ignore
          new HumanReporter().format(rawSyncResult, false)
        );
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => runWithCoverage)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(TestService.prototype, 'writeResultFiles');
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir',
      '--resultformat',
      'json',
      '-c'
    ])
    .it(
      'should create test-run-codecoverage file with correct content when code cov is specified',
      ctx => {
        expect((ctx.myStub as SinonStub).args).to.deep.equal([
          [
            runWithCoverage,
            {
              dirPath: 'path/to/dir',
              fileInfos: [
                {
                  filename: `test-result-${jsonWithCoverage.summary.testRunId}.json`,
                  content: jsonWithCoverage
                },
                {
                  filename: `test-result-codecoverage.json`,
                  content: jsonWithCoverage.coverage.coverage
                }
              ],
              resultFormats: [ResultFormat.junit]
            },
            true
          ]
        ]);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(TestService.prototype, 'writeResultFiles');
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir'
    ])
    .it(
      'should create no extra files when result format is not specified with asynchronous run',
      ctx => {
        expect((ctx.myStub as SinonStub).args[0]).to.deep.equal([
          testRunSimple,
          {
            dirPath: 'path/to/dir'
          },
          undefined
        ]);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestSynchronous', () => rawSyncResult)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(TestService.prototype, 'writeResultFiles');
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir',
      '-y'
    ])
    .it(
      'should create default files when result format is not specified with synchronous run',
      ctx => {
        // @ts-ignore
        const result = new HumanReporter().format(rawSyncResult);
        expect((ctx.myStub as SinonStub).args[0]).to.deep.equal([
          rawSyncResult,
          {
            dirPath: 'path/to/dir',
            fileInfos: [
              {
                filename: 'test-result.json',
                content: jsonSyncResult
              },
              {
                filename: `test-result.txt`,
                content: result
              }
            ],
            resultFormats: [ResultFormat.junit]
          },
          undefined
        ]);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => runWithCoverage)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(TestService.prototype, 'writeResultFiles');
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir',
      '--resultformat',
      'tap',
      '-c'
    ])
    .it(
      'should create tap file with correct content when tap format is specified',
      ctx => {
        expect((ctx.myStub as SinonStub).args).to.deep.equal([
          [
            runWithCoverage,
            {
              dirPath: 'path/to/dir',
              fileInfos: [
                {
                  filename: `test-result-${jsonWithCoverage.summary.testRunId}.json`,
                  content: jsonWithCoverage
                },
                {
                  filename: `test-result-codecoverage.json`,
                  content: jsonWithCoverage.coverage.coverage
                },
                {
                  content: `1..1\nok 1 MyApexTests.testConfig\n`,
                  filename: `test-result.txt`
                }
              ],
              resultFormats: [ResultFormat.junit, ResultFormat.tap]
            },
            true
          ]
        ]);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => runWithCoverage)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(TestService.prototype, 'writeResultFiles');
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir',
      '--resultformat',
      'junit',
      '-c'
    ])
    .it(
      'should create junit file with correct content when junit format is specified',
      ctx => {
        // @ts-ignore
        const result = new JUnitReporter().format(runWithCoverage);
        expect((ctx.myStub as SinonStub).args).to.deep.equal([
          [
            runWithCoverage,
            {
              dirPath: 'path/to/dir',
              fileInfos: [
                {
                  filename: `test-result-${jsonWithCoverage.summary.testRunId}.json`,
                  content: jsonWithCoverage
                },
                {
                  filename: `test-result-codecoverage.json`,
                  content: jsonWithCoverage.coverage.coverage
                },
                {
                  filename: `test-result.xml`,
                  content: result
                }
              ],
              resultFormats: [ResultFormat.junit]
            },
            true
          ]
        ]);
      }
    );

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => runWithCoverage)
    .do(ctx => {
      ctx.myStub = sandboxStub.stub(TestService.prototype, 'writeResultFiles');
    })
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexTests.testMethodOne',
      '-d',
      'path/to/dir',
      '--resultformat',
      'human',
      '-c'
    ])
    .it(
      'should create human-readable file with correct content when human-readable format is specified',
      ctx => {
        // @ts-ignore
        const result = new HumanReporter().format(runWithCoverage);
        expect((ctx.myStub as SinonStub).args).to.deep.equal([
          [
            runWithCoverage,
            {
              dirPath: 'path/to/dir',
              fileInfos: [
                {
                  filename: `test-result-${jsonWithCoverage.summary.testRunId}.json`,
                  content: jsonWithCoverage
                },
                {
                  filename: `test-result-codecoverage.json`,
                  content: jsonWithCoverage.coverage.coverage
                },
                {
                  filename: `test-result.txt`,
                  content: result
                }
              ],
              resultFormats: [ResultFormat.junit]
            },
            true
          ]
        ]);
      }
    );

  describe('Error checking', async () => {
    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--tests',
        'MyApexTests.testMethodOne',
        '--classnames',
        'MyApexTests',
        '--resultformat',
        'human'
      ])
      .it(
        'should throw an error if classnames and tests are specified',
        ctx => {
          expect(ctx.stderr).to.contain(
            messages.getMessage('classSuiteTestErr')
          );
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--tests',
        'MyApexTests.testMethodOne',
        '--suitenames',
        'MyApexSuite',
        '--resultformat',
        'human'
      ])
      .it(
        'should throw an error if suitenames and tests are specified',
        ctx => {
          expect(ctx.stderr).to.contain(
            messages.getMessage('classSuiteTestErr')
          );
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--tests',
        'MyApexTests.testMethodOne',
        '--suitenames',
        'MyApexSuite',
        '--resultformat',
        'human'
      ])
      .it(
        'should throw an error if suitenames and classnames are specified',
        ctx => {
          expect(ctx.stderr).to.contain(
            messages.getMessage('classSuiteTestErr')
          );
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--tests',
        'MyApexTests.testMethodOne',
        '-c'
      ])
      .it(
        'should throw an error if code coverage is specified but reporter is missing',
        ctx => {
          expect(ctx.stderr).to.contain(
            messages.getMessage('missingReporterErr')
          );
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--suitenames',
        'MyApexSuite',
        '--synchronous'
      ])
      .it(
        'should throw an error if suitenames is specifed with sync run',
        ctx => {
          expect(ctx.stderr).to.contain(messages.getMessage('syncClassErr'));
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--classnames',
        'MyApexClass,MySecondClass',
        '--synchronous'
      ])
      .it(
        'should throw an error if multiple classnames are specifed with sync run',
        ctx => {
          expect(ctx.stderr).to.contain(messages.getMessage('syncClassErr'));
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--suitenames',
        'MyApexSuite',
        '--testlevel',
        'RunLocalTests'
      ])
      .it(
        'should throw an error if test level is not "Run Specified Tests" for run with suites',
        ctx => {
          expect(ctx.stderr).to.contain(messages.getMessage('testLevelErr'));
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--classnames',
        'MyApexClass',
        '--synchronous',
        '--testlevel',
        'RunAllTestsInOrg'
      ])
      .it(
        'should throw an error if test level is not "Run Specified Tests" for run with classnames',
        ctx => {
          expect(ctx.stderr).to.contain(messages.getMessage('testLevelErr'));
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--tests',
        'MyApexClass.testInsertTrigger',
        '--synchronous',
        '--testlevel',
        'RunAllTestsInOrg'
      ])
      .it(
        'should throw an error if test level is not "Run Specified Tests" for run with tests',
        ctx => {
          expect(ctx.stderr).to.contain(messages.getMessage('testLevelErr'));
        }
      );

    test
      .withOrg({ username: TEST_USERNAME }, true)
      .loadConfig({
        root: __dirname
      })
      .stub(process, 'cwd', () => projectPath)
      .stub(TestService.prototype, 'runTestSynchronous', () => testRunSimple)
      .stdout()
      .stderr()
      .command([
        'force:apex:test:run',
        '--tests',
        'MyApexClass.testInsertTrigger,MySecondClass.testAfterTrigger',
        '--synchronous'
      ])
      .it(
        'should throw an error if test level is not "Run Specified Tests" for run with tests',
        ctx => {
          expect(ctx.stderr).to.contain(messages.getMessage('syncClassErr'));
        }
      );
  });

  test
    .withOrg({ username: TEST_USERNAME }, true)
    .loadConfig({
      root: __dirname
    })
    .stub(process, 'cwd', () => projectPath)
    .stub(TestService.prototype, 'runTestAsynchronous', () => testRunSimple)
    .stdout()
    .stderr()
    .command([
      'force:apex:test:run',
      '--tests',
      'MyApexClass.testInsertTrigger',
      '--outputdir',
      'my/path/to/dir',
      '-r',
      'human'
    ])
    .it(
      'should display warning message when output directory flag is specifed',
      ctx => {
        expect(ctx.stderr).to.include(messages.getMessage('warningMessage'));
      }
    );
});
