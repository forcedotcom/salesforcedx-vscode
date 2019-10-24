import { expect } from 'chai';
import * as path from 'path';
import { assert, SinonStub, stub } from 'sinon';
import { EventEmitter, workspace } from 'vscode';
import Uri from 'vscode-uri';
import { SfdxTestOutlineProvider } from '../../../../src/testSupport/testExplorer/testOutlineProvider';
import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';

import {
  TestCaseInfo,
  TestFileInfo,
  TestInfoKind,
  TestResultStatus,
  TestType
} from '../../../../src/testSupport/types';

describe('LWC Test Indexer', () => {
  const onDidCreateEventEmitter = new EventEmitter<Uri>();
  const onDidChangeEventEmitter = new EventEmitter<Uri>();
  const onDidDeleteEventEmitter = new EventEmitter<Uri>();
  const mockFileSystemWatcher = {
    onDidCreate: onDidCreateEventEmitter.event,
    onDidChange: onDidChangeEventEmitter.event,
    onDidDelete: onDidDeleteEventEmitter.event
  };
  let createFileSystemWatcherStub: SinonStub;
  beforeEach(() => {
    createFileSystemWatcherStub = stub(workspace, 'createFileSystemWatcher');
    createFileSystemWatcherStub.returns(mockFileSystemWatcher);
  });
  afterEach(() => {
    createFileSystemWatcherStub.restore();
  });
  const EXISTING_TEST_FILE_NUM = 1;

  it('should update index on test file create', async () => {
    lwcTestIndexer.resetIndex();
    let allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
    expect(allTestFileInfo.length).to.equal(EXISTING_TEST_FILE_NUM);

    const mockFilePath = '/var/mockNewFile.test.js';
    const mockFileUri = Uri.file(mockFilePath);
    onDidCreateEventEmitter.fire(mockFileUri);

    // const mockOnDidUpdateTestIndexListener = lwcTestIndexer.onDidUpdateTestIndex.event;

    allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
    expect(allTestFileInfo.length).to.equal(EXISTING_TEST_FILE_NUM + 1);

    const createdTestFileInfo = allTestFileInfo.find(
      (testFileInfo: TestFileInfo) => {
        return testFileInfo.testUri.fsPath === mockFilePath;
      }
    );
  });

  it('should update index on test file change', async () => {});

  it('should update index on test file delete', async () => {});

  // it('Configure and index should start');
});
