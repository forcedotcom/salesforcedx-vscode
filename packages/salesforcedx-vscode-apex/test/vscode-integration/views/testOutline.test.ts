/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression
import { SfCommandlet } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as events from 'events';
import * as fs from 'fs';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { APEX_GROUP_RANGE, APEX_TESTS, FAIL_RESULT, PASS_RESULT } from '../../../src/constants';
import { ClientStatus, LanguageClientUtils } from '../../../src/languageUtils/languageClientUtils';
import { nls } from '../../../src/messages';
import * as settings from '../../../src/settings';
import { apexTestRunCacheService } from '../../../src/testRunCache';
import { ApexTestMethod } from '../../../src/views/lspConverter';
import { ApexTestGroupNode, ApexTestNode, ApexTestOutlineProvider } from '../../../src/views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from '../../../src/views/testRunner';
import { generateApexTestMethod } from './testDataUtil';
import { apexLibMultipleResult, apexLibOneFileResult, apexLibTestInfo } from './testJSONOutputs';

const NO_TESTS_DESCRIPTION = nls.localize('test_view_no_tests_description');

describe('TestView', () => {
  let testOutline: ApexTestOutlineProvider;
  const apexTestInfo: ApexTestMethod[] = generateApexTestMethod();
  const sb: SinonSandbox = createSandbox();

  afterEach(() => {
    sb.restore();
  });

  describe('Code Coverage', () => {
    let commandletSpy: SinonSpy;
    let getCoverageStub: SinonStub;
    let languageClientUtils: LanguageClientUtils;

    beforeEach(() => {
      commandletSpy = sb.spy(SfCommandlet.prototype, 'run');
      getCoverageStub = sb.stub(settings, 'retrieveTestCodeCoverage');
      languageClientUtils = LanguageClientUtils.getInstance();
      languageClientUtils.setStatus(ClientStatus.Ready, 'Apex client is ready');
    });

    it('Should honor code coverage setting with Apex Library', async () => {
      const testRunner = new ApexTestRunner(testOutline);
      getCoverageStub.onFirstCall().returns(true);
      getCoverageStub.onSecondCall().returns(false);

      await testRunner.runApexTests(['MyTestTrue'], TestRunType.Method);
      let { executor } = commandletSpy.getCall(0).thisValue;
      expect(executor.codeCoverage).to.be.true;

      await testRunner.runApexTests(['MyTestFalse'], TestRunType.Method);
      executor = commandletSpy.getCall(1).thisValue.executor;
      expect(executor.codeCoverage).to.be.false;
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
      // apexTestRunCacheService is a singleton which means the values need to be
      // reset back to their default values otherwise they'll be set by the earlier
      // calls testRunner.runApexTests in this test suite
      await apexTestRunCacheService.setCachedClassTestParam('');
      await apexTestRunCacheService.setCachedMethodTestParam('');
      await testRunner.runApexTests([`${testMethod}`], TestRunType.Method);
      expect(apexTestRunCacheService.getLastMethodTestParam()).to.eq(testMethod);
      // the test class value should remain unchanged
      expect(apexTestRunCacheService.getLastClassTestParam()).to.eq('');
    });
    it('Should cache the last run test class', async () => {
      await testRunner.runApexTests([`${testClass}`], TestRunType.Class);
      expect(apexTestRunCacheService.getLastClassTestParam()).to.eq(testClass);
      // the test method value should remain unchanged
      expect(apexTestRunCacheService.getLastMethodTestParam()).to.eq(testMethod);
    });
    it('Should not change last run class or method when all tests are selected', async () => {
      await testRunner.runApexTests([`${testRunAll}`], TestRunType.All);
      expect(apexTestRunCacheService.getLastClassTestParam()).to.eq(testClass);
      expect(apexTestRunCacheService.getLastMethodTestParam()).to.eq(testMethod);
    });
  });

  describe('Get Tests and Create Tree', () => {
    it('Should add no tests', () => {
      testOutline = new ApexTestOutlineProvider(null);
      const expected = new ApexTestGroupNode(APEX_TESTS, null);
      expected.description = NO_TESTS_DESCRIPTION;
      expect(testOutline.getHead()).to.deep.equal(new ApexTestGroupNode(APEX_TESTS, null));
    });

    it('Should create one test and one class', () => {
      testOutline = new ApexTestOutlineProvider(apexTestInfo.slice(0, 1));
      if (testOutline.getHead()) {
        expect(testOutline.getHead().name).to.equal(APEX_TESTS);
        expect(testOutline.getHead().children.length).to.equal(1);
        const testChildGroup = testOutline.getHead().children[0];
        expect(testChildGroup).instanceof(ApexTestGroupNode);
        const groupLocation = new vscode.Location(apexTestInfo[0].location.uri, APEX_GROUP_RANGE);
        expect(testChildGroup.location).to.deep.equal(groupLocation);
        expect(testChildGroup.name).to.equal(apexTestInfo[0].definingType);
        expect(testChildGroup.children.length).to.equal(1);
        const testChild = testChildGroup.children[0];
        const fullName = apexTestInfo[0].definingType + '.' + apexTestInfo[0].methodName;
        expect(testChild.name).to.deep.equal(fullName);
        expect(testChild.location).to.deep.equal(apexTestInfo[0].location);
        expect(testOutline.getTestClassName(apexTestInfo[0].location.uri)).to.equal(apexTestInfo[0].definingType);
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
          const groupLocation = new vscode.Location(testInfo1.location.uri, APEX_GROUP_RANGE);
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

          expect(testOutline.getTestClassName(testInfo1.location.uri)).to.equal(testInfo1.definingType);
          expect(testOutline.getTestClassName(testInfo2.location.uri)).to.equal(testInfo2.definingType);
        }
      }
    });

    it('Should index test classes', () => {
      const pos = new vscode.Position(0, 0);
      testOutline = new ApexTestOutlineProvider([
        {
          definingType: 'Test1',
          methodName: 'validate1',
          location: {
            uri: vscode.Uri.file('/force-app/test/Test1.cls'),
            range: new vscode.Range(pos, pos)
          }
        },
        {
          definingType: 'Test1',
          methodName: 'validate2',
          location: {
            uri: vscode.Uri.file('/force-app/test/Test1.cls'),
            range: new vscode.Range(pos, pos)
          }
        },
        {
          definingType: 'Test2',
          methodName: 'verify',
          location: {
            uri: vscode.Uri.file('/force-app/test/Test2.cls'),
            range: new vscode.Range(pos, pos)
          }
        }
      ]);

      expect(testOutline.getTestClassName(vscode.Uri.file('/force-app/test/Test1.cls'))).to.equal('Test1');
      expect(testOutline.getTestClassName(vscode.Uri.file('/force-app/test/Test2.cls'))).to.equal('Test2');
      expect(testOutline.getTestClassName(vscode.Uri.file('/force-app/test/Test3.cls'))).to.be.undefined;
    });
  });

  describe('Read JSON file and update tests', () => {
    let readFolderStub: SinonStub;
    let readFileStub: SinonStub;
    let parseJSONStub: SinonStub;

    beforeEach(() => {
      readFolderStub = sb.stub(fs, 'readdirSync');
      readFolderStub.callsFake(folderName => {
        return ['test-result.json'];
      });
      readFileStub = sb.stub(fs, 'readFileSync');
      readFileStub.callsFake(fileName => {
        return 'nonsense';
      });
      parseJSONStub = sb.stub(JSON, 'parse');
    });

    it('Should update single test with Pass result using Apex library', () => {
      parseJSONStub.callsFake(() => {
        return apexLibOneFileResult;
      });

      testOutline = new ApexTestOutlineProvider(apexTestInfo.slice(0, 1));
      testOutline.updateTestResults('oneFilePass');
      const testGroupNode = testOutline.getHead().children[0] as ApexTestGroupNode;
      expect(testGroupNode.passing).to.equal(1);
      const testNode = testGroupNode.children[0] as ApexTestNode;
      expect(testNode.outcome).to.equal(PASS_RESULT);
    });

    it('Should update tests and test groups with passing/failing tests using Apex library', () => {
      parseJSONStub.callsFake(() => {
        return apexLibMultipleResult;
      });
      testOutline = new ApexTestOutlineProvider(apexLibTestInfo);
      testOutline.updateTestResults('multipleFilesMixed');

      expect(testOutline.getHead().children.length).to.equal(1);
      const groupNode = testOutline.getHead().children[0] as ApexTestGroupNode;
      expect(groupNode.passing).to.eql(2);
      expect(groupNode.failing).to.eql(1);

      expect(groupNode.children[0].name).to.equal('file0.test0');
      expect((groupNode.children[0] as ApexTestNode).outcome).to.equal(PASS_RESULT);
      expect(groupNode.children[1].name).to.equal('file0.test1');
      expect((groupNode.children[1] as ApexTestNode).outcome).to.equal(FAIL_RESULT);
      expect(groupNode.children[2].name).to.equal('file0.test2');
      expect((groupNode.children[2] as ApexTestNode).outcome).to.equal(PASS_RESULT);
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
      readFolderStub = sb.stub(fs, 'readdirSync');
      readFolderStub.callsFake(folderName => ['test-result.json']);
      readFileStub = sb.stub(fs, 'readFileSync');
      readFileStub.callsFake(fileName => 'nonsense');
      parseJSONStub = sb.stub(JSON, 'parse');
      parseJSONStub.callsFake(() => apexLibMultipleResult);
      eventEmitterStub = sb.stub(eventEmitter, 'emit');
      showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
      showTextDocumentStub.returns(Promise.resolve());

      testOutline = new ApexTestOutlineProvider(apexTestInfo);
      testOutline.updateTestResults('multipleFilesMixed');
      testRunner = new ApexTestRunner(testOutline, eventEmitter);
    });

    it('Should go to definition if a test does not have an error message', async () => {
      const testNode = new ApexTestNode('sampleTest', apexTestInfo[0].location);
      const testRange = testNode.location!.range;

      await testRunner.showErrorMessage(testNode);

      // make sure we emit the update_selection event with the correct position
      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal(['sf:update_selection', testRange]);
    });

    it('Should go to error if a test has one', async () => {
      const lineFailure = 22;
      const testNode = new ApexTestNode('failedTest', apexTestInfo[0].location);
      testNode.errorMessage = 'System.AssertException: Assertion Failed';
      testNode.stackTrace = `Class.fakeClass.test0: line ${lineFailure}, column 1`;

      await testRunner.showErrorMessage(testNode);

      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal(['sf:update_selection', lineFailure - 1]);
    });

    it('Should go to error of first failing test in a failed test class', async () => {
      const testClass = testOutline.getHead().children[0] as ApexTestGroupNode;
      const lineFailure = 40; // first failure in apexLibMultipleResult.apexLibMultipleTests

      await testRunner.showErrorMessage(testClass);

      expect(eventEmitterStub.getCall(0).args).to.be.deep.equal(['sf:update_selection', lineFailure - 1]);
    });
  });
});
