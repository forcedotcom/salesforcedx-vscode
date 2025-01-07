/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexTestResultOutcome, HumanReporter, TestLevel, TestResult, TestService } from '@salesforce/apex-node-bundle';
import { SfProject } from '@salesforce/core-bundle';
import * as pathUtils from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { expect } from 'chai';
import { join } from 'path';
import { assert, createSandbox, match, SinonStub } from 'sinon';
import { CancellationToken, DiagnosticSeverity, EventEmitter, Progress, Range, Uri } from 'vscode';
import {
  ApexLibraryTestRunExecutor,
  resolveTestClassParam,
  resolveTestMethodParam
} from '../../../src/commands/apexTestRunCodeAction';
import { workspaceContext } from '../../../src/context';

// return undefined: used to get around strict checks
const getUndefined = (): any => {
  return undefined;
};

/* eslint-disable @typescript-eslint/no-unused-expressions */
describe('Apex Test Run - Code Action', () => {
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
          exceptionStackTrace: 'System.AssertException: Assertion Failed Col: 18 Line: 2',
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
          exceptionStackTrace: 'System.AssertException: Assertion Failed Col: 15 Line: 3',
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
  describe('Apex Library Test Run Executor', () => {
    let runTestStub: SinonStub;
    let buildPayloadStub: SinonStub;
    let writeResultFilesStub: SinonStub;
    const defaultPackageDir = 'default/package/dir';
    const componentPath = join(defaultPackageDir, 'main', 'default', 'TestClass.cls');
    let reportStub: SinonStub;
    let progress: Progress<unknown>;
    let cancellationTokenEventEmitter;
    let cancellationToken: CancellationToken;
    beforeEach(() => {
      runTestStub = sb.stub(TestService.prototype, 'runTestAsynchronous').resolves(passingResult);
      sb.stub(workspaceContext, 'getConnection');
      buildPayloadStub = sb.stub(TestService.prototype, 'buildAsyncPayload');
      sb.stub(HumanReporter.prototype, 'format');
      writeResultFilesStub = sb.stub(TestService.prototype, 'writeResultFiles');
      sb.stub(SfProject, 'resolve').returns({
        getDefaultPackage: () => {
          return { fullPath: 'default/package/dir' };
        }
      });
      sb.stub(ComponentSet, 'fromSource').returns({
        getSourceComponents: () => {
          return {
            first: () => {
              return { content: componentPath };
            }
          };
        }
      });
      sb.stub(ApexLibraryTestRunExecutor.diagnostics, 'set');

      reportStub = sb.stub();
      progress = { report: reportStub };
      cancellationTokenEventEmitter = new EventEmitter();
      cancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: cancellationTokenEventEmitter.event
      };
    });
    afterEach(() => {
      sb.restore();
    });

    it('should run test with correct parameters for single test method with code coverage', async () => {
      buildPayloadStub.resolves({
        tests: [{ className: 'testClass', testMethods: ['oneTest'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(['testClass.oneTest'], 'path/to/dir', true);
      await apexLibExecutor.run(undefined, progress, cancellationToken);

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql(['RunSpecifiedTests', 'testClass.oneTest']);
      assert.calledOnce(runTestStub);
      assert.calledWith(
        runTestStub,
        {
          tests: [{ className: 'testClass', testMethods: ['oneTest'] }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        true,
        false,
        match.any,
        cancellationToken
      );
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
      await apexLibExecutor.run(undefined, progress, cancellationToken);

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql(['RunSpecifiedTests', 'testClass.oneTest,testClass.twoTest']);
      assert.calledOnce(runTestStub);
      assert.calledWith(
        runTestStub,
        {
          tests: [
            { className: 'testClass', testMethods: ['oneTest'] },
            { className: 'testClass', testMethods: ['twoTest'] }
          ],
          testLevel: TestLevel.RunSpecifiedTests
        },
        false,
        false,
        match.any,
        cancellationToken
      );
    });

    it('should run test with correct parameters for single test class with code coverage', async () => {
      buildPayloadStub.resolves({
        tests: [{ className: 'testClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(['testClass'], 'path/to/dir', true);
      await apexLibExecutor.run(undefined, progress, cancellationToken);

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql(['RunSpecifiedTests', 'testClass']);
      assert.calledOnce(runTestStub);
      assert.calledWith(
        runTestStub,
        {
          tests: [{ className: 'testClass' }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        true,
        false,
        match.any,
        cancellationToken
      );
    });

    it('should run test with correct parameters for multiple test classes without code coverage', async () => {
      buildPayloadStub.resolves({
        tests: [{ className: 'testClass' }, { className: 'secondTestClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(['testClass', 'secondTestClass'], 'path/to/dir', false);
      await apexLibExecutor.run(undefined, progress, cancellationToken);

      expect(buildPayloadStub.called).to.be.true;
      expect(buildPayloadStub.args[0]).to.eql(['RunSpecifiedTests', 'testClass,secondTestClass']);
      assert.calledOnce(runTestStub);
      assert.calledWith(
        runTestStub,
        {
          tests: [{ className: 'testClass' }, { className: 'secondTestClass' }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        false,
        false,
        match.any,
        cancellationToken
      );
    });

    it('should report progress', async () => {
      buildPayloadStub.resolves({
        tests: [
          { className: 'testClass' },
          {
            className: 'secondTestClass'
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      const apexLibExecutor = new ApexLibraryTestRunExecutor(['testClass', 'secondTestClass'], 'path/to/dir', false);
      runTestStub.callsFake((payload, codecoverage, exitEarly, progressReporter, token) => {
        progressReporter.report({
          type: 'StreamingClientProgress',
          value: 'streamingTransportUp',
          message: 'Listening for streaming state changes...'
        });
        progressReporter.report({
          type: 'StreamingClientProgress',
          value: 'streamingProcessingTestRun',
          message: 'Processing test run 707500000000000001',
          testRunId: '707500000000000001'
        });
        progressReporter.report({
          type: 'FormatTestResultProgress',
          value: 'retrievingTestRunSummary',
          message: 'Retrieving test run summary record'
        });
        progressReporter.report({
          type: 'FormatTestResultProgress',
          value: 'queryingForAggregateCodeCoverage',
          message: 'Querying for aggregate code coverage results'
        });
        return passingResult;
      });

      await apexLibExecutor.run(undefined, progress, cancellationToken);

      assert.calledWith(reportStub, {
        message: 'Listening for streaming state changes...'
      });
      assert.calledWith(reportStub, {
        message: 'Processing test run 707500000000000001'
      });
      assert.calledWith(reportStub, {
        message: 'Retrieving test run summary record'
      });
      assert.calledWith(reportStub, {
        message: 'Querying for aggregate code coverage results'
      });
    });

    it('should return if cancellation is requested', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor(['testClass', 'secondTestClass'], 'path/to/dir', false);
      runTestStub.callsFake(() => {
        cancellationToken.isCancellationRequested = true;
      });

      const result = await apexLibExecutor.run(undefined, progress, cancellationToken);

      assert.calledOnce(runTestStub);
      assert.notCalled(writeResultFilesStub);
      expect(result).to.eql(false);
    });
  });

  describe('Report Diagnostics', () => {
    const executor = new ApexLibraryTestRunExecutor(['TestClass', 'TestClassTwo'], 'path/to/dir', false);
    const defaultPackageDir = 'default/package/dir';
    const componentPath = join(defaultPackageDir, 'main', 'default', 'TestClass.cls');
    const diagnostics = testResult.tests.map(() => {
      const { exceptionMessage, exceptionStackTrace } = testResult.tests[0].diagnostic!;
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
      sb.stub(SfProject, 'resolve').returns({
        getDefaultPackage: () => {
          return { fullPath: 'default/package/dir' };
        }
      });
      componentPathStub = sb.stub(ComponentSet, 'fromSource').returns({
        getSourceComponents: () => {
          return {
            first: () => {
              return { content: componentPath };
            }
          };
        }
      });
      setDiagnosticStub = sb.stub(ApexLibraryTestRunExecutor.diagnostics, 'set');
      runTestStub = sb.stub(TestService.prototype, 'runTestAsynchronous').resolves(testResult);
      sb.stub(pathUtils, 'getTestResultsFolder');
    });

    afterEach(() => {
      sb.restore();
    });

    it('should clear diagnostics before setting new ones', async () => {
      const clearStub = sb.stub(ApexLibraryTestRunExecutor.diagnostics, 'clear');

      await executor.run();
      expect(clearStub.calledBefore(setDiagnosticStub)).to.be.true;
    });

    it('should set all diagnostic properties correctly', async () => {
      await executor.run();

      expect(setDiagnosticStub.calledWith(Uri.file(defaultPackageDir), [diagnostics[0]]));
    });

    it('should set multiple diagnostics correctly', async () => {
      await executor.run();
      expect(setDiagnosticStub.calledWith(Uri.file(defaultPackageDir), [diagnostics[0]]));
      expect(setDiagnosticStub.calledWith(Uri.file(defaultPackageDir), [diagnostics[1]]));
    });

    it('should not set diagnostic if filepath was not found', async () => {
      componentPathStub.returns({
        getSourceComponents: () => {
          return {
            first: () => {
              return { content: undefined };
            }
          };
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
});
