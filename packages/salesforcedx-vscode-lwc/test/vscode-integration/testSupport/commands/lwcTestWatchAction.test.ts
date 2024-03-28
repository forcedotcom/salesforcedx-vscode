/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import {
  lwcTestStartWatching,
  lwcTestStartWatchingCurrentFile,
  lwcTestStopWatching,
  lwcTestStopWatchingAllTests,
  lwcTestStopWatchingCurrentFile
} from '../../../../src/testSupport/commands/lwcTestWatchAction';
import { testWatcher } from '../../../../src/testSupport/testRunner/testWatcher';
import {
  createMockTestFileInfo,
  mockActiveTextEditorUri,
  mockGetLwcTestRunnerExecutable,
  mockSfTaskExecute,
  unmockActiveTextEditorUri,
  unmockGetLwcTestRunnerExecutable,
  unmockSfTaskExecute
} from '../mocks';

describe('LWC Test Watch Action', () => {
  beforeEach(() => {
    mockGetLwcTestRunnerExecutable();
    mockSfTaskExecute();
  });
  afterEach(() => {
    unmockGetLwcTestRunnerExecutable();
    unmockSfTaskExecute();
    testWatcher.stopWatchingAllTests();
  });

  const mockTestFileInfo = createMockTestFileInfo();

  it('Should start watching tests', async () => {
    await lwcTestStartWatching({ testExecutionInfo: mockTestFileInfo });
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(true);
  });

  it('Should start and stop watching tests', async () => {
    await lwcTestStartWatching({ testExecutionInfo: mockTestFileInfo });
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(true);
    await lwcTestStopWatching({ testExecutionInfo: mockTestFileInfo });
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(
      false
    );
  });

  it('Should stop watching all tests', async () => {
    const mockTestFileInfo2 = createMockTestFileInfo('mockTest2.test.js');
    await lwcTestStartWatching({ testExecutionInfo: mockTestFileInfo });
    await lwcTestStartWatching({ testExecutionInfo: mockTestFileInfo2 });
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(true);
    expect(testWatcher.isWatchingTest(mockTestFileInfo2.testUri)).to.equal(
      true
    );
    lwcTestStopWatchingAllTests();
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(
      false
    );
    expect(testWatcher.isWatchingTest(mockTestFileInfo2.testUri)).to.equal(
      false
    );
  });

  it('Stop watching all tests should not throw if no tests are being watched', async () => {
    expect(lwcTestStopWatchingAllTests).to.not.throw();
  });

  it('Should start and stop watching current file', async () => {
    mockActiveTextEditorUri(mockTestFileInfo.testUri);
    await lwcTestStartWatchingCurrentFile();
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(true);
    await lwcTestStopWatchingCurrentFile();
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(
      false
    );
    unmockActiveTextEditorUri();
  });
});
