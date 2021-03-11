/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexTestResultOutcome,
  HumanReporter,
  TestLevel,
  TestResult,
  TestService
} from '@salesforce/apex-node';
import { SfdxProject } from '@salesforce/core';
import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import { DiagnosticSeverity, Range, Uri } from 'vscode';
import {
  ApexLibraryTestRunExecutor,
  forceApexTestClassRunCodeAction,
  forceApexTestMethodRunCodeAction,
  ForceApexTestRunCodeActionExecutor,
  resolveTestClassParam,
  resolveTestMethodParam
} from '../../../src/commands/forceApexTestRunCodeAction';
import { workspaceContext } from '../../../src/context';
import * as settings from '../../../src/settings';

// return undefined: used to get around strict checks
function getUndefined(): any {
  return undefined;
}

describe('Force Apex Test Run - Code Action', () => {
  describe('Command builder - Test Class', () => {
    const testClass = 'MyTests';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testClass],
      false,
      outputToJson
    );

    it('Should build command for single test class', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --outputdir outputToJson --loglevel error`
      );
    });
  });

  describe('Command builder - Test Class with Coverage', () => {
    const testClass = 'MyTests';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testClass],
      true,
      outputToJson
    );

    it('Should build command for single test class with code coverage', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --outputdir outputToJson --loglevel error --codecoverage`
      );
    });
  });

  describe('Command builder - Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testMethod],
      false,
      outputToJson
    );

    it('Should build command for single test method', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --outputdir outputToJson --loglevel error`
      );
    });
  });

  describe('Command builder - Test Method with Coverage', () => {
    const testMethod = 'MyTests.testMe';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testMethod],
      true,
      outputToJson
    );

    it('Should build command for single test method with code coverage', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --outputdir outputToJson --loglevel error --codecoverage`
      );
    });
  });

  describe('Cached Test Class', () => {
    const testClass = 'MyTests';
    const testClass2 = 'MyTests2';
    it('Should return cached value', async () => {
      let resolvedTestClass = await resolveTestClassParam(getUndefined());
      expect(resolvedTestClass).to.equal(undefined);

      resolvedTestClass = await resolveTestClassParam(testClass);
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = await resolveTestClassParam('');
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = await resolveTestClassParam(getUndefined());
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = await resolveTestClassParam(testClass2);
      expect(resolvedTestClass).to.equal(testClass2);

      resolvedTestClass = await resolveTestClassParam('');
      expect(resolvedTestClass).to.equal(testClass2);
    });
  });

  describe('Cached Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const testMethod2 = 'MyTests.testMe2';
    it('Should return cached value', async () => {
      let resolvedTestMethod = await resolveTestMethodParam(getUndefined());
      expect(resolvedTestMethod).to.equal(undefined);

      resolvedTestMethod = await resolveTestMethodParam(testMethod);
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = await resolveTestMethodParam('');
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = await resolveTestMethodParam(getUndefined());
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = await resolveTestMethodParam(testMethod2);
      expect(resolvedTestMethod).to.equal(testMethod2);

      resolvedTestMethod = await resolveTestMethodParam('');
      expect(resolvedTestMethod).to.equal(testMethod2);
    });
  });

  const testResult: TestResult = {
    summary: {
      failRate: '0%',
      failing: 0,
      testsRan: 2,
      orgId: 'xxxx908373',
      outcome: 'Failed',
      passRate: '100%',
      passing: 5,
      skipRate: '0%',
      skipped: 0,
      testExecutionTimeInMs: 25,
      testStartTime: '2:00:00PM',
      testTotalTimeInMs: 25,
      commandTimeInMs: 25,
      hostname: 'NA95',
      username: 'testusername@testing.com',
      testRunId: 'xxxx9056',
      userId: 'xxx555'
    },
    tests: [
      {
        asyncApexJobId: 'xxx9678',
        id: 'xxxx56',
        apexClass: {
          fullName: 'TestClass',
          name: 'TestClass',
          namespacePrefix: '',
          id: 'xx567'
        },
        queueItemId: 'xxxQUEUEID',
        stackTrace: 'System.AssertException: Assertion Failed Col: 18 Line: 2',
        message: 'System.AssertException: Assertion Failed',
        methodName: 'testMethod',
        outcome: ApexTestResultOutcome.Fail,
        runTime: 5,
        apexLogId: 'xxxLogId90',
        testTimestamp: '2:00:00PM',
        fullName: 'TestClass.testMethod',
        diagnostic: {
          exceptionMessage: 'System.AssertException: Assertion Failed',
          exceptionStackTrace:
            'System.AssertException: Assertion Failed Col: 18 Line: 2',
          compileProblem: '',
          lineNumber: 6,
          columnNumber: 1,
          className: 'TestClass'
        }
      },
      {
        asyncApexJobId: 'xxx9678',
        id: 'xxxx56',
        apexClass: {
          fullName: 'TestClass',
          name: 'TestClassTwo',
          namespacePrefix: '',
          id: 'xx567'
        },
        queueItemId: 'xxxQUEUEID',
        stackTrace: 'System.AssertException: Assertion Failed Col: 15 Line: 3',
        message: 'System.AssertException: Assertion Failed',
        methodName: 'testMethodTwo',
        outcome: ApexTestResultOutcome.Fail,
        runTime: 5,
        apexLogId: 'xxxLogId90',
        testTimestamp: '2:00:00PM',
        fullName: 'TestClassTwo.testMethodTwo',
        diagnostic: {
          exceptionMessage: 'System.AssertException: Assertion Failed',
          exceptionStackTrace:
            'System.AssertException: Assertion Failed Col: 15 Line: 3',
          compileProblem: '',
          lineNumber: 3,
          columnNumber: 15,
          className: 'TestClassTwo'
        }
      }
    ]
  };
  const passingResult: TestResult = {
    summary: {
      failRate: '0%',
      failing: 0,
      testsRan: 2,
      orgId: 'xxxx908373',
      outcome: 'Passed',
      passRate: '100%',
      passing: 5,
      skipRate: '0%',
      skipped: 0,
      testExecutionTimeInMs: 25,
      testStartTime: '2:00:00PM',
      testTotalTimeInMs: 25,
      commandTimeInMs: 25,
      hostname: 'NA95',
      username: 'testusername@testing.com',
      testRunId: 'xxxx9056',
      userId: 'xxx555'
    },
    tests: [
      {
        asyncApexJobId: 'xxx9678',
        id: 'xxxx56',
        apexClass: {
          fullName: 'TestClass',
          name: 'TestClass',
          namespacePrefix: '',
          id: 'xx567'
        },
        queueItemId: 'xxxQUEUEID',
        stackTrace: '',
        message: '',
        methodName: 'testMethod',
        outcome: ApexTestResultOutcome.Pass,
        runTime: 5,
        apexLogId: 'xxxLogId90',
        testTimestamp: '2:00:00PM',
        fullName: 'TestClass.testMethod'
      },
      {
        asyncApexJobId: 'xxx9678',
        id: 'xxxx56',
        apexClass: {
          fullName: 'TestClass',
          name: 'TestClassTwo',
          namespacePrefix: '',
          id: 'xx567'
        },
        queueItemId: 'xxxQUEUEID',
        stackTrace: '',
        message: '',
        methodName: 'testMethodTwo',
        outcome: ApexTestResultOutcome.Pass,
        runTime: 5,
        apexLogId: 'xxxLogId90',
        testTimestamp: '2:00:00PM',
        fullName: 'TestClassTwo.testMethodTwo'
      }
    ]
  };
  const sb = createSandbox();
  // tslint:disable:no-unused-expression
  describe('Apex Library Test Run Executor', async () => {
    let runTestStub: SinonStub;
    let buildPayloadStub: SinonStub;
    const defaultPackageDir = 'default/package/dir';
    const componentPath = join(
      defaultPackageDir,
      'main',
      'default',
      'TestClass.cls'
    );
    beforeEach(async () => {
      runTestStub = sb
        .stub(TestService.prototype, 'runTestAsynchronous')
        .resolves(passingResult);
      sb.stub(workspaceContext, 'getConnection');
      buildPayloadStub = sb.stub(TestService.prototype, 'buildAsyncPayload');
      sb.stub(HumanReporter.prototype, 'format');
      sb.stub(TestService.prototype, 'writeResultFiles');
      sb.stub(SfdxProject, 'resolve').returns({
        getDefaultPackage: () => {
          return { fullPath: 'default/package/dir' };
        }
      });
      sb.stub(ComponentSet, 'fromSource').returns({
        getSourceComponents: () => {
          return {
            next: () => {
              return { value: { content: componentPath } };
            }
          } as IterableIterator<{ content: string }>;
        }
      });
      sb.stub(ApexLibraryTestRunExecutor.diagnostics, 'set');
    });
    afterEach(async () => {
      sb.restore();
    });

    it('should run test with correct parameters for single test method with code coverage', async () => {
      buildPayloadStub.resolves({
        tests: [{ className: 'testClass', testMethods: ['oneTest'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass.oneTest'],
        'path/to/dir',
        true
      );
      await apexLibExecutor.run();

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql([
        'RunSpecifiedTests',
        'testClass.oneTest'
      ]);
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [{ className: 'testClass', testMethods: ['oneTest'] }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        true
      ]);
    });

    it('should run test with correct parameters for multiple test methods without code coverage', async () => {
      buildPayloadStub.resolves({
        tests: [
          { className: 'testClass', testMethods: ['oneTest'] },
          { className: 'testClass', testMethods: ['twoTest'] }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass.oneTest', 'testClass.twoTest'],
        'path/to/dir',
        false
      );
      await apexLibExecutor.run();

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql([
        'RunSpecifiedTests',
        'testClass.oneTest,testClass.twoTest'
      ]);
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [
            { className: 'testClass', testMethods: ['oneTest'] },
            { className: 'testClass', testMethods: ['twoTest'] }
          ],
          testLevel: TestLevel.RunSpecifiedTests
        },
        false
      ]);
    });

    it('should run test with correct parameters for single test class with code coverage', async () => {
      buildPayloadStub.resolves({
        tests: [{ className: 'testClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass'],
        'path/to/dir',
        true
      );
      await apexLibExecutor.run();

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql([
        'RunSpecifiedTests',
        'testClass'
      ]);
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [{ className: 'testClass' }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        true
      ]);
    });

    it('should run test with correct parameters for multiple test classes without code coverage', async () => {
      buildPayloadStub.resolves({
        tests: [{ className: 'testClass' }, { className: 'secondTestClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass', 'secondTestClass'],
        'path/to/dir',
        false
      );
      await apexLibExecutor.run();

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql([
        'RunSpecifiedTests',
        'testClass,secondTestClass'
      ]);
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [{ className: 'testClass' }, { className: 'secondTestClass' }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        false
      ]);
    });
  });

  describe('Report Diagnostics', () => {
    const executor = new ApexLibraryTestRunExecutor(
      ['TestClass', 'TestClassTwo'],
      'path/to/dir',
      false
    );
    const defaultPackageDir = 'default/package/dir';
    const componentPath = join(
      defaultPackageDir,
      'main',
      'default',
      'TestClass.cls'
    );
    const diagnostics = testResult.tests.map(test => {
      const {
        exceptionMessage,
        exceptionStackTrace
      } = testResult.tests[0].diagnostic!;
      return {
        message: `${exceptionMessage}\n${exceptionStackTrace}`,
        severity: DiagnosticSeverity.Error,
        source: componentPath,
        range: new Range(5, 0, 5, 0)
      };
    });

    let setDiagnosticStub: SinonStub;
    let runTestStub: SinonStub;
    let componentPathStub: SinonStub;

    beforeEach(() => {
      sb.stub(TestService.prototype, 'writeResultFiles');
      sb.stub(workspaceContext, 'getConnection');
      sb.stub(SfdxProject, 'resolve').returns({
        getDefaultPackage: () => {
          return { fullPath: 'default/package/dir' };
        }
      });
      componentPathStub = sb.stub(ComponentSet, 'fromSource').returns({
        getSourceComponents: () => {
          return {
            next: () => {
              return { value: { content: componentPath } };
            }
          } as IterableIterator<{ content: string }>;
        }
      });
      setDiagnosticStub = sb.stub(
        ApexLibraryTestRunExecutor.diagnostics,
        'set'
      );
      runTestStub = sb
        .stub(TestService.prototype, 'runTestAsynchronous')
        .resolves(testResult);
      sb.stub(TestRunner.prototype, 'getTempFolder');
    });

    afterEach(() => {
      sb.restore();
    });

    it('should clear diagnostics before setting new ones', async () => {
      const clearStub = sb.stub(
        ApexLibraryTestRunExecutor.diagnostics,
        'clear'
      );

      await executor.run();
      expect(clearStub.calledBefore(setDiagnosticStub)).to.be.true;
    });

    it('should set all diagnostic properties correctly', async () => {
      await executor.run();

      expect(
        setDiagnosticStub.calledWith(Uri.file(defaultPackageDir), [
          diagnostics[0]
        ])
      );
    });

    it('should set multiple diagnostics correctly', async () => {
      await executor.run();
      expect(
        setDiagnosticStub.calledWith(Uri.file(defaultPackageDir), [
          diagnostics[0]
        ])
      );
      expect(
        setDiagnosticStub.calledWith(Uri.file(defaultPackageDir), [
          diagnostics[1]
        ])
      );
    });

    it('should not set diagnostic if filepath was not found', async () => {
      componentPathStub.returns({
        getSourceComponents: () => {
          return {
            next: () => {
              return { value: { content: undefined } };
            }
          } as IterableIterator<{ content: string }>;
        }
      });
      await executor.run();
      expect(setDiagnosticStub.notCalled).to.be.true;
    });

    it('should not set diagnostic if test has no associated diagnostic', async () => {
      runTestStub.resolves(passingResult);
      await executor.run();
      expect(setDiagnosticStub.notCalled).to.be.true;
    });
  });

  describe('Use Apex Library Setting', async () => {
    let settingStub: SinonStub;
    let apexExecutorStub: SinonStub;
    let cliExecutorStub: SinonStub;

    beforeEach(async () => {
      settingStub = sb.stub(settings, 'useApexLibrary');
      apexExecutorStub = sb.stub(
        ApexLibraryTestRunExecutor.prototype,
        'run'
      );
      cliExecutorStub = sb.stub(
        ForceApexTestRunCodeActionExecutor.prototype,
        'execute'
      );
    });
    afterEach(async () => {
      sb.restore();
    });

    it('should use the ApexLibraryTestRunExecutor if setting is true', async () => {
      settingStub.returns(true);
      await forceApexTestClassRunCodeAction('testClass');
      await forceApexTestMethodRunCodeAction('testClass.testMethod');
      expect(apexExecutorStub.calledTwice).to.be.true;
      expect(cliExecutorStub.called).to.be.false;
    });

    it('should use the ForceApexTestClassRunCodeActionExecutor if setting is false', async () => {
      settingStub.returns(false);
      await forceApexTestClassRunCodeAction('testClass');
      await forceApexTestMethodRunCodeAction('testClass.testMethod');
      expect(cliExecutorStub.calledTwice).to.be.true;
      expect(apexExecutorStub.called).to.be.false;
    });
  });
});
