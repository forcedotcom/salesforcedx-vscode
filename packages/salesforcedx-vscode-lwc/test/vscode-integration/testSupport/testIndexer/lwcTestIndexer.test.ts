/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as fs from 'fs';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';

import { TestFileInfo, TestInfoKind, TestResultStatus, TestType } from '../../../../src/testSupport/types';

describe('LWC Test Indexer', function () {
  this.timeout(30000);
  let lwcTests: URI[];
  let existingTestFileCount: number;

  before(async () => {
    lwcTests = await vscode.workspace.findFiles(
      new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], '**/lwc/**/*.test.js')
    );

    existingTestFileCount = lwcTests.length;
  });

  describe('Test Indexer File Watcher', () => {
    let onDidCreateEventEmitter: vscode.EventEmitter<vscode.Uri>;
    let onDidChangeEventEmitter: vscode.EventEmitter<vscode.Uri>;
    let onDidDeleteEventEmitter: vscode.EventEmitter<vscode.Uri>;
    let readFileStub: SinonStub;
    let mockFileSystemWatcher;

    let createFileSystemWatcherStub: SinonStub<
      [vscode.GlobPattern, (boolean | undefined)?, (boolean | undefined)?, (boolean | undefined)?],
      vscode.FileSystemWatcher
    >;
    beforeEach(async () => {
      createFileSystemWatcherStub = stub(vscode.workspace, 'createFileSystemWatcher');
      onDidCreateEventEmitter = new vscode.EventEmitter<vscode.Uri>();
      onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
      onDidDeleteEventEmitter = new vscode.EventEmitter<vscode.Uri>();
      mockFileSystemWatcher = {
        onDidCreate: onDidCreateEventEmitter.event,
        onDidChange: onDidChangeEventEmitter.event,
        onDidDelete: onDidDeleteEventEmitter.event
      };
      createFileSystemWatcherStub.returns(mockFileSystemWatcher as vscode.FileSystemWatcher);

      const mockFile = `it('mockTestCase1', () => {})\nit('mockTestCase2', () => {})\n`;
      readFileStub = stub(fs, 'readFileSync');
      readFileStub.callsFake(fileName => {
        return mockFile;
      });

      await lwcTestIndexer.configureAndIndex();
      lwcTestIndexer.resetIndex();
    });
    afterEach(() => {
      onDidCreateEventEmitter.dispose();
      onDidChangeEventEmitter.dispose();
      onDidDeleteEventEmitter.dispose();
      createFileSystemWatcherStub.restore();
      readFileStub.restore();
    });

    function assertTestCasesMatch(actualTestFileInfo: TestFileInfo | undefined, expectedFilePath: string) {
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
      expect(allTestFileInfo.length).to.equal(existingTestFileCount);

      const mockFilePath = /^win32/.test(process.platform)
        ? 'C:\\Users\\tester\\mockNewFile.test.js'
        : '/Users/tester/mockNewFile.test.js';
      const mockFileUri = URI.file(mockFilePath);
      return new Promise<void>(resolve => {
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(async () => {
          allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
          expect(allTestFileInfo.length).to.equal(existingTestFileCount + 1);

          const createdTestFileInfo = allTestFileInfo.find((testFileInfo: TestFileInfo) => {
            return testFileInfo.testUri.fsPath === mockFileUri.fsPath;
          });
          expect(createdTestFileInfo!.kind).to.equal(TestInfoKind.TEST_FILE);
          expect(createdTestFileInfo!.testType).to.equal(TestType.LWC);
          expect(createdTestFileInfo!.testLocation!.uri.fsPath).to.equal(mockFileUri.fsPath);
          expect(createdTestFileInfo!.testLocation!.range.start.line).to.equal(0);
          expect(createdTestFileInfo!.testLocation!.range.start.character).to.equal(0);
          expect(createdTestFileInfo!.testLocation!.range.end.line).to.equal(0);
          expect(createdTestFileInfo!.testLocation!.range.end.character).to.equal(0);

          assertTestCasesMatch(createdTestFileInfo, mockFileUri.fsPath);
          handleDidUpdateTestIndex.dispose();
          resolve();
        });
        onDidCreateEventEmitter.fire(mockFileUri);
      });
    });

    it('should update index on test file change', async () => {
      const testFileUriToChange = lwcTests[0];
      let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
      expect(allTestFileInfo.length).to.equal(existingTestFileCount);
      return new Promise<void>(resolve => {
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(async () => {
          allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
          const changedTestFileInfo = allTestFileInfo.find((testFileInfo: TestFileInfo) => {
            return testFileInfo.testUri.fsPath === testFileUriToChange.fsPath;
          });
          assertTestCasesMatch(changedTestFileInfo, testFileUriToChange.fsPath);
          handleDidUpdateTestIndex.dispose();
          resolve();
        });
        onDidChangeEventEmitter.fire(testFileUriToChange);
      });
    });

    it('should update index on test file change when parsing has an error', async () => {
      // Mock parsing error
      readFileStub.callsFake(fileName => {
        throw new Error();
      });
      const testFileUriToChange = lwcTests[0];
      let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
      expect(allTestFileInfo.length).to.equal(existingTestFileCount);
      return new Promise<void>(resolve => {
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(async () => {
          allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
          const changedTestFileInfo = allTestFileInfo.find((testFileInfo: TestFileInfo) => {
            return testFileInfo.testUri.fsPath === testFileUriToChange.fsPath;
          });
          // If there's a parsing error, expect empty test cases info
          expect(changedTestFileInfo!.testCasesInfo).to.eql([]);
          handleDidUpdateTestIndex.dispose();
          resolve();
        });
        onDidChangeEventEmitter.fire(testFileUriToChange);
      });
    });

    it('should update index on test file change and merge existing test results if possible', async () => {
      const testFileUriToChange = lwcTests[0];
      let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
      expect(allTestFileInfo.length).to.equal(existingTestFileCount);

      // Mock raw test results on test file info
      // This could be test results generated from previous runs,
      // we are making sure that it will get merged in test cases info when test file changes.
      const testFileInfoToChange = allTestFileInfo.find((testFileInfo: TestFileInfo) => {
        return testFileInfo.testUri.fsPath === testFileUriToChange.fsPath;
      });
      testFileInfoToChange!.rawTestResults = [
        {
          title: 'mockTestCase1',
          ancestorTitles: [],
          status: TestResultStatus.PASSED
        },
        {
          title: 'mockTestCase2',
          ancestorTitles: [],
          status: TestResultStatus.FAILED
        }
      ];

      return new Promise<void>(resolve => {
        // Set up test file change handler
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(async () => {
          allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
          const changedTestFileInfo = allTestFileInfo.find((testFileInfo: TestFileInfo) => {
            return testFileInfo.testUri.fsPath === testFileUriToChange.fsPath;
          });

          // Assert that raw test results status is merged into test cases info
          const expectedTestCases = [
            {
              testFsPath: testFileUriToChange.fsPath,
              testName: 'mockTestCase1',
              testResult: {
                status: TestResultStatus.PASSED
              }
            },
            {
              testFsPath: testFileUriToChange.fsPath,
              testName: 'mockTestCase2',
              testResult: {
                status: TestResultStatus.FAILED
              }
            }
          ];
          expect(
            changedTestFileInfo!.testCasesInfo!.map(testCaseInfo => {
              const { testName, testResult, testUri } = testCaseInfo;
              return {
                testFsPath: testUri.fsPath,
                testName,
                testResult
              };
            })
          ).to.eql(expectedTestCases);

          // Restore
          handleDidUpdateTestIndex.dispose();
          testFileInfoToChange!.rawTestResults = undefined;
          resolve();
        });
        // Changing the file
        onDidChangeEventEmitter.fire(testFileUriToChange);
      });
    });

    it('should update index on test file delete', async () => {
      let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
      expect(allTestFileInfo.length).to.equal(existingTestFileCount);
      const testFileUriToDelete = lwcTests[0];
      return new Promise<void>(resolve => {
        const handleDidUpdateTestIndex = lwcTestIndexer.onDidUpdateTestIndex(async () => {
          allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
          expect(allTestFileInfo.length).to.equal(existingTestFileCount - 1);

          const deletedTestFileInfo = allTestFileInfo.find((testFileInfo: TestFileInfo) => {
            return testFileInfo.testUri.fsPath === testFileUriToDelete.fsPath;
          });
          expect(deletedTestFileInfo).to.be.an('undefined');
          handleDidUpdateTestIndex.dispose();
          resolve();
        });
        onDidDeleteEventEmitter.fire(testFileUriToDelete);
      });
    });
  });
});
