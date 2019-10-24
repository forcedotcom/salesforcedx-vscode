import { expect } from 'chai';
import * as vscode from 'vscode';
import Uri from 'vscode-uri';
import { nls } from '../../../../src/messages';
import {
  SfdxTestGroupNode,
  SfdxTestNode,
  sortTestNodeByLabel
} from '../../../../src/testSupport/testExplorer/testNode';
import {
  TestCaseInfo,
  TestFileInfo,
  TestInfoKind,
  TestResultStatus,
  TestType
} from '../../../../src/testSupport/types';

describe('Sfdx Test Node', () => {
  describe('Should set correct values for test nodes', () => {
    it('Should set correct values for SfdxTestGroupNode', () => {
      const testExecutionInfo: TestFileInfo = {
        kind: TestInfoKind.TEST_FILE,
        testType: TestType.LWC,
        testUri: Uri.file('/var/mockTest.test.js')
      };
      const mockLabel = 'mockTest';
      const groupNode = new SfdxTestGroupNode(mockLabel, testExecutionInfo);
      const expectedCollpasibleState =
        vscode.TreeItemCollapsibleState.Collapsed;
      const expectedContextValue = 'lwcTestGroup';
      const expectedCommand = {
        command: 'sfdx.force.lightning.lwc.test.navigateToTest',
        title: nls.localize('force_lightning_lwc_test_navigate_to_test'),
        arguments: [groupNode]
      };
      const expectedDescription = mockLabel;
      expect(groupNode.collapsibleState).to.equal(expectedCollpasibleState);
      expect(groupNode.command).to.deep.equal(expectedCommand);
      expect(groupNode.description).equal(expectedDescription);
      expect(groupNode.contextValue).equal(expectedContextValue);
    });

    it('Should set correct values for SfdxTestNode', () => {
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri: Uri.file('/var/mockTest.test.js'),
        testName: 'mockTestName'
      };
      const mockLabel = 'mockTestName';
      const testNode = new SfdxTestNode(mockLabel, testExecutionInfo);
      const expectedCollpasibleState = vscode.TreeItemCollapsibleState.None;
      const expectedContextValue = 'lwcTest';
      const expectedCommand = {
        command: 'sfdx.force.lightning.lwc.test.navigateToTest',
        title: nls.localize('force_lightning_lwc_test_navigate_to_test'),
        arguments: [testNode]
      };
      const expectedDescription = mockLabel;
      expect(testNode.collapsibleState).to.equal(expectedCollpasibleState);
      expect(testNode.command).to.deep.equal(expectedCommand);
      expect(testNode.description).equal(expectedDescription);
      expect(testNode.contextValue).equal(expectedContextValue);
    });
  });

  describe('Should set correct icon paths for test nodes', () => {
    const testExecutionInfo: TestCaseInfo = {
      kind: TestInfoKind.TEST_CASE,
      testType: TestType.LWC,
      testUri: Uri.file('/var/mockTest.test.js'),
      testName: 'mockTest'
    };

    it('Should set correct icon paths for tests not run', () => {
      testExecutionInfo.testResult = undefined;
      const mockLabel = 'mockTest';
      const groupNode = new SfdxTestNode(mockLabel, testExecutionInfo);
      expect(groupNode.iconPath.dark.endsWith('testNotRun.svg')).to.equal(true);
      expect(groupNode.iconPath.light.endsWith('testNotRun.svg')).to.equal(
        true
      );
    });

    it('Should set correct icon paths for passed tests', () => {
      testExecutionInfo.testResult = { status: TestResultStatus.PASSED };
      const mockLabel = 'mockTest';
      const groupNode = new SfdxTestNode(mockLabel, testExecutionInfo);
      expect(groupNode.iconPath.dark.endsWith('testPass.svg')).to.equal(true);
      expect(groupNode.iconPath.light.endsWith('testPass.svg')).to.equal(true);
    });

    it('Should set correct icon paths for failed tests', () => {
      testExecutionInfo.testResult = { status: TestResultStatus.FAILED };
      const mockLabel = 'mockTest';
      const groupNode = new SfdxTestNode(mockLabel, testExecutionInfo);
      expect(groupNode.iconPath.dark.endsWith('testFail.svg')).to.equal(true);
      expect(groupNode.iconPath.light.endsWith('testFail.svg')).to.equal(true);
    });

    it('Should set correct icon paths for skipped tests', () => {
      testExecutionInfo.testResult = { status: TestResultStatus.SKIPPED };
      const mockLabel = 'mockTest';
      const groupNode = new SfdxTestNode(mockLabel, testExecutionInfo);
      expect(groupNode.iconPath.dark.endsWith('testSkip.svg')).to.equal(true);
      expect(groupNode.iconPath.light.endsWith('testSkip.svg')).to.equal(true);
    });

    it('Should set correct icon paths for tests with unkown results', () => {
      testExecutionInfo.testResult = {
        status: TestResultStatus.UNKNOWN
      };
      const mockLabel = 'mockTest';
      const groupNode = new SfdxTestNode(mockLabel, testExecutionInfo);
      expect(groupNode.iconPath.dark.endsWith('testNotRun.svg')).to.equal(true);
      expect(groupNode.iconPath.light.endsWith('testNotRun.svg')).to.equal(
        true
      );
    });
  });

  describe('Should sort test nodes by label', () => {
    const testExecutionInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri: Uri.file('/var/mock')
    };

    it('Comparator should return -1 when first node does not have label', () => {
      const groupNode1 = new SfdxTestGroupNode('file1', testExecutionInfo);
      const groupNode2 = new SfdxTestGroupNode('file2', testExecutionInfo);
      groupNode1.label = undefined;
      groupNode2.label = 'mock';
      expect(sortTestNodeByLabel(groupNode1, groupNode2)).to.equal(-1);
    });
    it('Comparator should return 1 when second node does not have label', () => {
      const groupNode1 = new SfdxTestGroupNode('file1', testExecutionInfo);
      const groupNode2 = new SfdxTestGroupNode('file2', testExecutionInfo);
      groupNode1.label = 'mock';
      groupNode2.label = undefined;
      expect(sortTestNodeByLabel(groupNode1, groupNode2)).to.equal(1);
    });
    it('Comparator should compare alphabetically', () => {
      const groupNode1 = new SfdxTestGroupNode('file1', testExecutionInfo);
      const groupNode2 = new SfdxTestGroupNode('file2', testExecutionInfo);
      groupNode1.label = 'apple';
      groupNode2.label = 'cheese';
      expect(sortTestNodeByLabel(groupNode1, groupNode2)).to.equal(-1);
      groupNode1.label = 'dog';
      groupNode2.label = 'cat';
      expect(sortTestNodeByLabel(groupNode1, groupNode2)).to.equal(1);
      groupNode1.label = 'equal';
      groupNode2.label = 'equal';
      expect(sortTestNodeByLabel(groupNode1, groupNode2)).to.equal(0);
    });
  });
});
