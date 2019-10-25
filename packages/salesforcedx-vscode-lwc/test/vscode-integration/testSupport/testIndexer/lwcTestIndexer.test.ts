import { expect } from 'chai';
import * as jestTestSupport from 'jest-editor-support';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import Uri from 'vscode-uri';
import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';

import {
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';

describe('LWC Test Indexer', () => {
  let lwcTests: Uri[];
  before(async () => {
    lwcTests = await vscode.workspace.findFiles(
      new vscode.RelativePattern(
        vscode.workspace.workspaceFolders![0],
        '**/lwc/**/demoLwcComponent.test.js'
      )
    );
  });

  describe('Test Indexer File Watcher', () => {
    let onDidCreateEventEmitter: vscode.EventEmitter<Uri>;
    let onDidChangeEventEmitter: vscode.EventEmitter<Uri>;
    let onDidDeleteEventEmitter: vscode.EventEmitter<Uri>;
    let mockFileSystemWatcher;
    const mockItBlocks = [
      {
        type: 'it',
        name: 'mockTestCase1',
        nameRange: {
          start: {
            line: 10,
            column: 20
          },
          end: {
            line: 10,
            column: 25
          }
        },
        ancestorTitles: []
      },
      {
        type: 'it',
        name: 'mockTestCase2',
        nameRange: {
          start: {
            line: 30,
            column: 10
          },
          end: {
            line: 30,
            column: 15
          }
        },
        ancestorTitles: []
      }
    ];
    const mockParseResults = {
      itBlocks: mockItBlocks,
      root: {
        type: 'root',
        children: [...mockItBlocks]
      }
    };
    let createFileSystemWatcherStub: SinonStub;
    let parseStub: SinonStub;
    beforeEach(async () => {
      createFileSystemWatcherStub = stub(
        vscode.workspace,
        'createFileSystemWatcher'
      );
      onDidCreateEventEmitter = new vscode.EventEmitter<Uri>();
      onDidChangeEventEmitter = new vscode.EventEmitter<Uri>();
      onDidDeleteEventEmitter = new vscode.EventEmitter<Uri>();
      mockFileSystemWatcher = {
        onDidCreate: onDidCreateEventEmitter.event,
        onDidChange: onDidChangeEventEmitter.event,
        onDidDelete: onDidDeleteEventEmitter.event
      };
      createFileSystemWatcherStub.returns(mockFileSystemWatcher);
      parseStub = stub(jestTestSupport, 'parse');
      parseStub.returns(mockParseResults);
      // start mock file system watcher
      await lwcTestIndexer.configureAndIndex();
      lwcTestIndexer.resetIndex();
    });
    afterEach(() => {
      onDidCreateEventEmitter.dispose();
      onDidChangeEventEmitter.dispose();
      onDidDeleteEventEmitter.dispose();
      createFileSystemWatcherStub.restore();
      parseStub.restore();
    });
    const EXISTING_TEST_FILE_NUM = 1;
    function assertTestCasesMatch(
      actualTestFileInfo: TestFileInfo | undefined,
      expectedFilePath: string
    ) {
      const expectedTestCases = [
        {
          testFsPath: expectedFilePath,
          testName: 'mockTestCase1'
        },
        {
          testFsPath: expectedFilePath,
          testName: 'mockTestCase2'
        }
      ];
      expect(
        actualTestFileInfo!.testCasesInfo!.map(testCaseInfo => {
          const { testName, testUri } = testCaseInfo;
          return {
            testFsPath: testUri.fsPath,
            testName
          };
        })
      ).to.eql(expectedTestCases);
    }

    it('should update index on test file create', async () => {
      let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
      expect(allTestFileInfo.length).to.equal(EXISTING_TEST_FILE_NUM);

      const mockFilePath = '/var/mockNewFile.test.js';
      const mockFileUri = Uri.file(mockFilePath);
      return new Promise(resolve => {
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(
          async () => {
            allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
            expect(allTestFileInfo.length).to.equal(EXISTING_TEST_FILE_NUM + 1);

            const createdTestFileInfo = allTestFileInfo.find(
              (testFileInfo: TestFileInfo) => {
                return testFileInfo.testUri.fsPath === mockFilePath;
              }
            );
            expect(createdTestFileInfo!.kind).to.equal(TestInfoKind.TEST_FILE);
            expect(createdTestFileInfo!.testType).to.equal(TestType.LWC);
            expect(createdTestFileInfo!.testLocation!.uri.fsPath).to.equal(
              mockFilePath
            );
            expect(
              createdTestFileInfo!.testLocation!.range.start.line
            ).to.equal(0);
            expect(
              createdTestFileInfo!.testLocation!.range.start.character
            ).to.equal(0);
            expect(createdTestFileInfo!.testLocation!.range.end.line).to.equal(
              0
            );
            expect(
              createdTestFileInfo!.testLocation!.range.end.character
            ).to.equal(0);

            assertTestCasesMatch(createdTestFileInfo, mockFilePath);
            handleDidUpdateTestIndex.dispose();
            resolve();
          }
        );
        onDidCreateEventEmitter.fire(mockFileUri);
      });
    });

    it('should update index on test file change', async () => {
      const testFileUriToChange = lwcTests[0];
      let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
      expect(allTestFileInfo.length).to.equal(EXISTING_TEST_FILE_NUM);
      return new Promise(resolve => {
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(
          async () => {
            allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
            const changedTestFileInfo = allTestFileInfo.find(
              (testFileInfo: TestFileInfo) => {
                return (
                  testFileInfo.testUri.fsPath === testFileUriToChange.fsPath
                );
              }
            );
            assertTestCasesMatch(
              changedTestFileInfo,
              testFileUriToChange.fsPath
            );
            handleDidUpdateTestIndex.dispose();
            resolve();
          }
        );
        onDidChangeEventEmitter.fire(testFileUriToChange);
      });
    });

    it('should update index on test file delete', async () => {
      let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
      expect(allTestFileInfo.length).to.equal(EXISTING_TEST_FILE_NUM);
      const testFileUriToDelete = lwcTests[0];
      return new Promise(resolve => {
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(
          async () => {
            allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
            expect(allTestFileInfo.length).to.equal(EXISTING_TEST_FILE_NUM - 1);

            const deletedTestFileInfo = allTestFileInfo.find(
              (testFileInfo: TestFileInfo) => {
                return (
                  testFileInfo.testUri.fsPath === testFileUriToDelete.fsPath
                );
              }
            );
            expect(deletedTestFileInfo).to.be.an('undefined');
            handleDidUpdateTestIndex.dispose();
            resolve();
          }
        );
        onDidDeleteEventEmitter.fire(testFileUriToDelete);
      });
    });
  });
});
