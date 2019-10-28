/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { assert, match, SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../../../../src/messages';
import { forceLwcTestNavigateToTest } from '../../../../src/testSupport/commands/forceLwcTestNavigateToTest';
import { forceLwcTestRefreshTestExplorer } from '../../../../src/testSupport/commands/forceLwcTestRefreshTestExplorer';
import {
  forceLwcTestCaseRun,
  forceLwcTestFileRun,
  forceLwcTestRun,
  forceLwcTestRunAllTests
} from '../../../../src/testSupport/commands/forceLwcTestRunAction';
import {
  SfdxTestGroupNode,
  SfdxTestNode
} from '../../../../src/testSupport/testExplorer/testNode';
import { SfdxTestOutlineProvider } from '../../../../src/testSupport/testExplorer/testOutlineProvider';
import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';
import { SfdxTask } from '../../../../src/testSupport/testRunner/taskService';
import {
  TestExecutionInfo,
  TestInfoKind,
  TestResultStatus,
  TestType
} from '../../../../src/testSupport/types';
import {
  mockGetLwcTestRunnerExecutable,
  mockSfdxTaskExecute,
  unmockGetLwcTestRunnerExecutable,
  unmockSfdxTaskExecute
} from '../mocks';
import {
  testCaseFailureResult,
  testCaseSuccessResult,
  testFileResult
} from '../mocks/testResultsMocks';

describe('LWC Test Outline Provider', () => {
  describe('Should load exiting test files into test explorer view Unit Tests', () => {
    let findAllTestFileInfoStub: SinonStub;
    beforeEach(() => {
      findAllTestFileInfoStub = stub(lwcTestIndexer, 'findAllTestFileInfo');
    });
    afterEach(() => {
      findAllTestFileInfoStub.restore();
    });

    const mockFilePaths = Array.from({ length: 3 }, (array, i) => {
      return /^win32/.test(process.platform)
        ? `C:\\Users\\tester\\mockTest${i + 1}.test.js`
        : `/Users/tester/mockTest${i + 1}.test.js`;
    });
    const outlineProvder = new SfdxTestOutlineProvider();
    it('Should provide test group nodes', async () => {
      const mockAllTestFileInfo = mockFilePaths.map(mockFilePath => ({
        kind: TestInfoKind.TEST_FILE,
        testType: TestType.LWC,
        testUri: URI.file(mockFilePath)
      }));
      findAllTestFileInfoStub.returns(mockAllTestFileInfo);
      const nodes = await outlineProvder.getChildren();
      expect(nodes.length).to.equal(3);
      expect(nodes.map(node => node.label)).to.eql([
        'mockTest1',
        'mockTest2',
        'mockTest3'
      ]);
    });

    it('Should sort test group nodes by label', async () => {
      const mockAllTestFileInfo = [...mockFilePaths]
        .reverse()
        .map(mockFilePath => ({
          kind: TestInfoKind.TEST_FILE,
          testType: TestType.LWC,
          testUri: URI.file(mockFilePath)
        }));
      findAllTestFileInfoStub.returns(mockAllTestFileInfo);
      const nodes = await outlineProvder.getChildren();
      expect(nodes.length).to.equal(3);
      expect(nodes.map(node => node.label)).to.eql([
        'mockTest1',
        'mockTest2',
        'mockTest3'
      ]);
    });

    it('Should provide no nodes if no tests found', async () => {
      findAllTestFileInfoStub.returns([]);
      const nodes = await outlineProvder.getChildren();
      expect(nodes).to.eql([]);
    });
  });

  describe('Test Explorer Integration Tests', () => {
    let lwcTests: URI[];
    let lwcTestUri: URI;
    let outlineProvder: SfdxTestOutlineProvider;
    let actualFileNodes: SfdxTestGroupNode[];
    let actualTestCaseNodes: SfdxTestNode[];
    before(async () => {
      lwcTests = await vscode.workspace.findFiles(
        new vscode.RelativePattern(
          vscode.workspace.workspaceFolders![0],
          '**/lwc/**/demoLwcComponent.test.js'
        )
      );
      lwcTestUri = lwcTests[0];
      // Replace with integration test file uri
      testFileResult.testResults[0].name = lwcTestUri.fsPath;
      testCaseSuccessResult.testResults[0].name = lwcTestUri.fsPath;
      testCaseFailureResult.testResults[0].name = lwcTestUri.fsPath;
      outlineProvder = new SfdxTestOutlineProvider();
      actualFileNodes = await outlineProvder.getChildren();
      actualTestCaseNodes = await outlineProvder.getChildren(
        actualFileNodes[0]
      );
    });

    let activeTextEditorStub: SinonStub;
    let showTextDocumentStub: SinonStub;
    let revealRangeStub: SinonStub;
    const mockActiveTextEditor = {
      document: {
        lineAt: (line: number) => {}
      },
      revealRange: (
        range: vscode.Range,
        revealType?: vscode.TextEditorRevealType
      ) => {}
    };
    beforeEach(() => {
      mockGetLwcTestRunnerExecutable();
      mockSfdxTaskExecute();
      showTextDocumentStub = stub(vscode.window, 'showTextDocument');
      showTextDocumentStub.callsFake(() => {});
      activeTextEditorStub = stub(vscode.window, 'activeTextEditor').get(() => {
        return mockActiveTextEditor;
      });
      revealRangeStub = stub(
        vscode.window.activeTextEditor as vscode.TextEditor,
        'revealRange'
      );
    });
    afterEach(() => {
      unmockGetLwcTestRunnerExecutable();
      unmockSfdxTaskExecute();
      showTextDocumentStub.restore();
      activeTextEditorStub.restore();
      revealRangeStub.restore();
    });

    it('Should provide test file nodes and test cases nodes', async () => {
      expect(actualFileNodes.length).to.equal(1);
      const actualFileNode = actualFileNodes[0];
      const expectedFileNode = {
        label: 'demoLwcComponent',
        description: 'demoLwcComponent',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: 'lwcTestGroup',
        command: {
          command: 'sfdx.force.lightning.lwc.test.navigateToTest',
          title: nls.localize('force_lightning_lwc_test_navigate_to_test'),
          arguments: [actualFileNode]
        }
      };
      assert.match(actualFileNode, expectedFileNode);

      const expectedTestCaseNodes = [
        {
          label: 'Displays greeting',
          description: 'Displays greeting',
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: 'lwcTest',
          command: {
            command: 'sfdx.force.lightning.lwc.test.navigateToTest',
            title: nls.localize('force_lightning_lwc_test_navigate_to_test'),
            arguments: [actualTestCaseNodes[0]]
          }
        },
        {
          label: 'Failed test',
          description: 'Failed test',
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: 'lwcTest',
          command: {
            command: 'sfdx.force.lightning.lwc.test.navigateToTest',
            title: nls.localize('force_lightning_lwc_test_navigate_to_test'),
            arguments: [actualTestCaseNodes[1]]
          }
        }
      ];
      expect(actualTestCaseNodes.length).to.equal(2);
      assert.match(actualTestCaseNodes[0], expectedTestCaseNodes[0]);
      assert.match(actualTestCaseNodes[1], expectedTestCaseNodes[1]);
    });

    it('Should run all tests', async () => {
      const commandResult = (await forceLwcTestRunAllTests()) as SfdxTask;
      commandResult.onDidEnd(() => {
        lwcTestIndexer.updateTestResults(testFileResult);
      });
      return new Promise(resolve => {
        const handleDidChangeTreeData = outlineProvder.onDidChangeTreeData(
          async () => {
            actualFileNodes = await outlineProvder.getChildren();
            actualTestCaseNodes = await outlineProvder.getChildren(
              actualFileNodes[0]
            );
            expect(
              actualFileNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.FAILED);
            expect(
              actualTestCaseNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.PASSED);
            expect(
              actualTestCaseNodes[1].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.FAILED);
            handleDidChangeTreeData.dispose();
            resolve();
          }
        );
      });
    });

    it('Should run tests from test file nodes', async () => {
      const commandResult = (await forceLwcTestFileRun(actualFileNodes[0] as {
        testExecutionInfo: TestExecutionInfo;
      })) as SfdxTask;
      commandResult.onDidEnd(() => {
        lwcTestIndexer.updateTestResults(testFileResult);
      });
      return new Promise(resolve => {
        const handleDidChangeTreeData = outlineProvder.onDidChangeTreeData(
          async () => {
            actualFileNodes = await outlineProvder.getChildren();
            actualTestCaseNodes = await outlineProvder.getChildren(
              actualFileNodes[0]
            );
            expect(
              actualFileNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.FAILED);
            expect(
              actualTestCaseNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.PASSED);
            expect(
              actualTestCaseNodes[1].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.FAILED);
            handleDidChangeTreeData.dispose();
            resolve();
          }
        );
      });
    });

    it('Should navigate to test file from test file nodes', () => {
      forceLwcTestNavigateToTest(actualFileNodes[0]);
      assert.calledOnce(showTextDocumentStub);
      assert.calledOnce(revealRangeStub);
      assert.calledWith(
        revealRangeStub,
        match(
          new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
        )
      );
    });

    it('Should navigate to test case from test case nodes', () => {
      forceLwcTestNavigateToTest(actualTestCaseNodes[0]);
      assert.calledOnce(showTextDocumentStub);
      assert.calledOnce(revealRangeStub);
      assert.calledWith(
        revealRangeStub,
        match(
          new vscode.Range(
            new vscode.Position(11, 6),
            new vscode.Position(11, 23)
          )
        )
      );
    });

    it('Should run test from a successful test case node', async () => {
      const commandResult = (await forceLwcTestCaseRun(actualFileNodes[0] as {
        testExecutionInfo: TestExecutionInfo;
      })) as SfdxTask;
      commandResult.onDidEnd(() => {
        lwcTestIndexer.updateTestResults(testCaseSuccessResult);
      });
      return new Promise(resolve => {
        const handleDidChangeTreeData = outlineProvder.onDidChangeTreeData(
          async () => {
            actualFileNodes = await outlineProvder.getChildren();
            actualTestCaseNodes = await outlineProvder.getChildren(
              actualFileNodes[0]
            );
            expect(
              actualFileNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.PASSED);
            expect(
              actualTestCaseNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.PASSED);
            expect(
              actualTestCaseNodes[1].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.SKIPPED);
            handleDidChangeTreeData.dispose();
            resolve();
          }
        );
      });
    });

    it('Should run test from a failed test case node and generates diagnostics for the test uri', async () => {
      const commandResult = (await forceLwcTestCaseRun(actualFileNodes[0] as {
        testExecutionInfo: TestExecutionInfo;
      })) as SfdxTask;
      commandResult.onDidEnd(() => {
        lwcTestIndexer.updateTestResults(testCaseFailureResult);
      });
      return new Promise(resolve => {
        const handleDidChangeTreeData = outlineProvder.onDidChangeTreeData(
          async () => {
            actualFileNodes = await outlineProvder.getChildren();
            actualTestCaseNodes = await outlineProvder.getChildren(
              actualFileNodes[0]
            );
            expect(
              actualFileNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.FAILED);
            expect(
              actualTestCaseNodes[0].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.SKIPPED);
            expect(
              actualTestCaseNodes[1].testExecutionInfo!.testResult!.status
            ).to.equal(TestResultStatus.FAILED);

            const expectedErrorMessageBeginning = `Error: expect(received).toEqual(expected) // deep equality\n\nExpected: 2\nReceived: 1\n`;
            expect(
              vscode.languages
                .getDiagnostics(lwcTestUri)[0]
                .message.startsWith(expectedErrorMessageBeginning)
            ).to.equal(true);
            handleDidChangeTreeData.dispose();
            resolve();
          }
        );
      });
    });

    it('Should refresh test explorer', async () => {
      lwcTestIndexer.updateTestResults(testCaseSuccessResult);
      actualFileNodes = await outlineProvder.getChildren();
      actualTestCaseNodes = await outlineProvder.getChildren(
        actualFileNodes[0]
      );
      expect(
        actualTestCaseNodes[0].testExecutionInfo!.testResult!.status
      ).to.equal(TestResultStatus.PASSED);
      forceLwcTestRefreshTestExplorer();

      actualFileNodes = await outlineProvder.getChildren();
      actualTestCaseNodes = await outlineProvder.getChildren(
        actualFileNodes[0]
      );
      expect(actualFileNodes[0].testExecutionInfo!.testResult).to.equal(
        undefined
      );
      expect(actualTestCaseNodes[0].testExecutionInfo!.testResult).to.equal(
        undefined
      );
      expect(actualTestCaseNodes[1].testExecutionInfo!.testResult).to.equal(
        undefined
      );
    });
  });
});
