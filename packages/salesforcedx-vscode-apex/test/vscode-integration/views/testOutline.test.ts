/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression
import { expect } from 'chai';
import * as events from 'events';
import * as fs from 'fs';
import { SinonSpy, SinonStub, spy, stub } from 'sinon';
import * as vscode from 'vscode';
import { APEX_GROUP_RANGE } from '../../../src/constants';
import {
  ClientStatus,
  LanguageClientUtils
} from '../../../src/languageClientUtils/languageClientUtils';
import { nls } from '../../../src/messages';
import { forceApexTestRunCacheService } from '../../../src/testRunCache';
import { ApexTestMethod } from '../../../src/views/lspConverter';
import {
  ApexTestGroupNode,
  ApexTestNode,
  ApexTestOutlineProvider
} from '../../../src/views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from '../../../src/views/testRunner';
import { generateApexTestMethod } from './testDataUtil';
import {
  jsonSummaryMultipleFiles,
  jsonSummaryOneFilePass
} from './testJSONOutputs';

const NO_TESTS_DESCRIPTION = nls.localize(
  'force_test_view_no_tests_description'
);

describe('TestView', () => {
  let testOutline: ApexTestOutlineProvider;
  const apexTestInfo: ApexTestMethod[] = generateApexTestMethod();

  describe('Code Coverage', () => {
    const coreExports = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-core'
    )!.exports;
    let commandletSpy: SinonSpy;
    let getCoverageStub: SinonStub;
    let languageClientUtils: LanguageClientUtils;

    beforeEach(() => {
      commandletSpy = spy(coreExports.SfdxCommandlet.prototype, 'run');
      getCoverageStub = stub(
        coreExports.sfdxCoreSettings,
        'getRetrieveTestCodeCoverage'
      );
      languageClientUtils = LanguageClientUtils.getInstance();
      languageClientUtils.setStatus(ClientStatus.Ready, 'Apex client is ready');
    });

    afterEach(() => {
      commandletSpy.restore();
      getCoverageStub.restore();
    });

    it('Should honor code coverage setting', async () => {
      const testRunner = new ApexTestRunner(testOutline);
      getCoverageStub.onFirstCall().returns(true);
      getCoverageStub.onSecondCall().returns(false);

      await testRunner.runApexTests(['MyTestTrue'], TestRunType.Method);
      let { executor } = commandletSpy.getCall(0).thisValue;
      expect(executor.shouldGetCodeCoverage).to.be.true;

      await testRunner.runApexTests(['MyTestFalse'], TestRunType.Method);
      executor = commandletSpy.getCall(1).thisValue.executor;
      expect(executor.shouldGetCodeCoverage).to.be.false;
    });
  });

  describe('Runtest caching for re-run', () => {
    const testRunner = new ApexTestRunner(testOutline);
    const testMethod = 'MyTestMethod';
    const testClass = 'MyTestClass';
    const testRunAll = 'RunAll';
    let languageClientUtils: LanguageClientUtils;

    beforeEach(() => {
      languageClientUtils = LanguageClientUtils.getInstance();
      languageClientUtils.setStatus(ClientStatus.Ready, 'Apex client is ready');
    });

    it('Should cache the last run test method', async () => {
      // forceApexTestRunCacheService is a singleton which means the values need to be
      // reset back to their default values otherwise they'll be set by the earlier
      // calls testRunner.runApexTests in this test suite
      await forceApexTestRunCacheService.setCachedClassTestParam('');
      await forceApexTestRunCacheService.setCachedMethodTestParam('');
      await testRunner.runApexTests([`${testMethod}`], TestRunType.Method);
      expect(forceApexTestRunCacheService.getLastMethodTestParam()).to.eq(
        testMethod
      );
      // the test class value should remain unchanged
      expect(forceApexTestRunCacheService.getLastClassTestParam()).to.eq('');
    });
    it('Should cache the last run test class', async () => {
      await testRunner.runApexTests([`${testClass}`], TestRunType.Class);
      expect(forceApexTestRunCacheService.getLastClassTestParam()).to.eq(
        testClass
      );
      // the test method value should remain unchanged
      expect(forceApexTestRunCacheService.getLastMethodTestParam()).to.eq(
        testMethod
      );
    });
    it('Should not change last run class or method when all tests are selected', async () => {
      await testRunner.runApexTests([`${testRunAll}`], TestRunType.All);
      expect(forceApexTestRunCacheService.getLastClassTestParam()).to.eq(
        testClass
      );
      expect(forceApexTestRunCacheService.getLastMethodTestParam()).to.eq(
        testMethod
      );
    });
  });

  describe('Get Tests and Create Tree', () => {
    it('Should add no tests', () => {
      testOutline = new ApexTestOutlineProvider(null);
      const expected = new ApexTestGroupNode('ApexTests', null);
      expected.description = NO_TESTS_DESCRIPTION;
      expect(testOutline.getHead()).to.deep.equal(
        new ApexTestGroupNode('ApexTests', null)
      );
    });

    it('Should create one test and one class', () => {
      testOutline = new ApexTestOutlineProvider(apexTestInfo.slice(0, 1));
      if (testOutline.getHead()) {
        expect(testOutline.getHead().name).to.equal('ApexTests');
        expect(testOutline.getHead().children.length).to.equal(1);
        const testChildGroup = testOutline.getHead().children[0];
        expect(testChildGroup).instanceof(ApexTestGroupNode);
        const groupLocation = new vscode.Location(
          apexTestInfo[0].location.uri,
          APEX_GROUP_RANGE
        );
        expect(testChildGroup.location).to.deep.equal(groupLocation);
        expect(testChildGroup.name).to.equal(apexTestInfo[0].definingType);
        expect(testChildGroup.children.length).to.equal(1);
        const testChild = testChildGroup.children[0];
        const fullName =
          apexTestInfo[0].definingType + '.' + apexTestInfo[0].methodName;
        expect(testChild.name).to.deep.equal(fullName);
        expect(testChild.location).to.deep.equal(apexTestInfo[0].location);
      }
    });

    it('Should update tests with 8 tests and 4 classes', () => {
      testOutline = new ApexTestOutlineProvider(apexTestInfo);
      if (testOutline.getHead()) {
        expect(testOutline.getHead().children.length).to.equal(4);
        let i = 0;
        for (const testChildGroup of testOutline.getHead().children) {
          const testInfo1 = apexTestInfo[i];
          i++;
          const testInfo2 = apexTestInfo[i];
          expect(testChildGroup.children.length).to.equal(2); // Each group has two children
          expect(testChildGroup.name).to.equal(testInfo1.definingType);
          const groupLocation = new vscode.Location(
            testInfo1.location.uri,
            APEX_GROUP_RANGE
          );
          expect(testChildGroup.location).to.deep.equal(groupLocation);
          // Check child test
          const test1 = testChildGroup.children[0];
          const test2 = testChildGroup.children[1];
          const fullName1 = testInfo1.definingType + '.' + testInfo1.methodName;
          const fullName2 = testInfo2.definingType + '.' + testInfo2.methodName;
          expect(test1.name).to.equal(fullName1);
          expect(test2.name).to.equal(fullName2);
          expect(test1.location).to.deep.equal(testInfo1.location);
          expect(test2.location).to.deep.equal(testInfo2.location);
          i++;
        }
      }
    });
  });

  describe('Read JSON file and update tests', () => {
    let readFolderStub: SinonStub;
    let readFileStub: SinonStub;
    let parseJSONStub: SinonStub;
    // let jsonSummaryAll: FullTestResult;

    beforeEach(() => {
      readFolderStub = stub(fs, 'readdirSync');
      readFolderStub.callsFake(folderName => {
        return ['test-result.json'];
      });
      readFileStub = stub(fs, 'readFileSync');
      readFileStub.callsFake(fileName => {
        return 'nonsense';
      });
      parseJSONStub = stub(JSON, 'parse');
    });

    afterEach(() => {
      readFolderStub.restore();
      readFileStub.restore();
      parseJSONStub.restore();
    });

    it('Should update single test with Pass result', () => {
      parseJSONStub.callsFake(() => {
        return jsonSummaryOneFilePass;
      });
      testOutline = new ApexTestOutlineProvider(apexTestInfo.slice(0, 1));
      testOutline.readJSONFile('oneFilePass');
      const testGroupNode = testOutline.getHead()
        .children[0] as ApexTestGroupNode;
      expect(testGroupNode.passing).to.equal(1);
      const testNode = testGroupNode.children[0] as ApexTestNode;
      expect(testNode.outcome).to.equal('Pass');
    });

    it('Should update tests and test groups with 8 results, 6 passing and 2 failing', () => {
      parseJSONStub.callsFake(() => {
        return jsonSummaryMultipleFiles;
      });
      testOutline = new ApexTestOutlineProvider(apexTestInfo);
      testOutline.readJSONFile('multipleFilesMixed');
      let classNum = 0;
      expect(testOutline.getHead().children.length).to.equal(4);
      for (const testGroupNode of testOutline.getHead().children) {
        let outcome = 'Pass';
        if (classNum === 0 || classNum === 3) {
          // Failing Class
          expect((testGroupNode as ApexTestGroupNode).passing).to.equal(1);
          let testNode = testGroupNode.children[0] as ApexTestNode;
          if (classNum === 3) {
            // Tests 1 and 6 fail
            outcome = 'Fail';
          }
          expect(testNode.outcome).to.equal(outcome);
          outcome = 'Pass';
          testNode = testGroupNode.children[1] as ApexTestNode;
          if (classNum === 0) {
            // Tests 1 and 6 fail
            outcome = 'Fail';
          }
          expect(testNode.outcome).to.equal(outcome);
        } else {
          // Passing class
          expect((testGroupNode as ApexTestGroupNode).passing).to.equal(2);
          let testNode = testGroupNode.children[0] as ApexTestNode;
          expect(testNode.outcome).to.equal(outcome);
          testNode = testGroupNode.children[1] as ApexTestNode;
          expect(testNode.outcome).to.equal(outcome);
        }
        classNum++;
      }
    });
  });

  describe('Navigate to test definition or error', () => {
    let readFolderStub: SinonStub;
    let readFileStub: SinonStub;
    let parseJSONStub: SinonStub;
    let showTextDocumentStub: SinonStub;
    let eventEmitterStub: SinonStub;

    let testRunner: ApexTestRunner;
    const eventEmitter = new events.EventEmitter();

    beforeEach(() => {
      readFolderStub = stub(fs, 'readdirSync');
      readFolderStub.callsFake(folderName => ['test-result.json']);
      readFileStub = stub(fs, 'readFileSync');
      readFileStub.callsFake(fileName => 'nonsense');
      parseJSONStub = stub(JSON, 'parse');
      parseJSONStub.callsFake(() => jsonSummaryMultipleFiles);
      eventEmitterStub = stub(eventEmitter, 'emit');
      showTextDocumentStub = stub(vscode.window, 'showTextDocument');
      showTextDocumentStub.returns(Promise.resolve());

      testOutline = new ApexTestOutlineProvider(apexTestInfo);
      testOutline.readJSONFile('multipleFilesMixed');
      testRunner = new ApexTestRunner(testOutline, eventEmitter);
    });

    afterEach(() => {
      readFolderStub.restore();
      readFileStub.restore();
      parseJSONStub.restore();
      eventEmitterStub.restore();
      showTextDocumentStub.restore();
    });

    it('Should go to definition if a test does not have an error message', async () => {
      const testNode = new ApexTestNode('sampleTest', apexTestInfo[0].location);
      const testRange = testNode.location!.range;

      await testRunner.showErrorMessage(testNode);

      // make sure we emit the update_selection event with the correct position
      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal([
        'sfdx:update_selection',
        testRange
      ]);
    });

    it('Should go to error if a test has one', async () => {
      const lineFailure = 22;
      const testNode = new ApexTestNode('failedTest', apexTestInfo[0].location);
      testNode.errorMessage = 'System.AssertException: Assertion Failed';
      testNode.stackTrace = `Class.fakeClass.test0: line ${lineFailure}, column 1`;

      await testRunner.showErrorMessage(testNode);

      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal([
        'sfdx:update_selection',
        lineFailure - 1
      ]);
    });

    it('Should go to error of first failing test in a failed test class', async () => {
      const testClass = testOutline.getHead().children[0] as ApexTestGroupNode;
      const lineFailure = 40; // first failure in testJSONOutputs.testResultsMultipleFiles

      await testRunner.showErrorMessage(testClass);

      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal([
        'sfdx:update_selection',
        lineFailure - 1
      ]);
    });
  });
});
