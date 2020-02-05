/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import {
  forceLwcTestStartWatching,
  forceLwcTestStartWatchingCurrentFile,
  forceLwcTestStopWatching,
  forceLwcTestStopWatchingCurrentFile
} from '../../../../src/testSupport/commands/forceLwcTestWatchAction';
import { testWatcher } from '../../../../src/testSupport/testRunner/testWatcher';
import {
  createMockTestFileInfo,
  mockActiveTextEditorUri,
  mockGetLwcTestRunnerExecutable,
  mockSfdxTaskExecute,
  unmockActiveTextEditorUri,
  unmockGetLwcTestRunnerExecutable,
  unmockSfdxTaskExecute
} from '../mocks';

describe('Force LWC Test Watch Action', () => {
  beforeEach(() => {
    mockGetLwcTestRunnerExecutable();
    mockSfdxTaskExecute();
  });
  afterEach(() => {
    unmockGetLwcTestRunnerExecutable();
    unmockSfdxTaskExecute();
    testWatcher.stopWatchingAllTests();
  });

  const mockTestFileInfo = createMockTestFileInfo();

  it('Should start watching tests', async () => {
    await forceLwcTestStartWatching({ testExecutionInfo: mockTestFileInfo });
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(true);
  });

  it('Should start and stop watching tests', async () => {
    await forceLwcTestStartWatching({ testExecutionInfo: mockTestFileInfo });
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(true);
    await forceLwcTestStopWatching({ testExecutionInfo: mockTestFileInfo });
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(
      false
    );
  });

  it('Should start and stop watching current file', async () => {
    mockActiveTextEditorUri(mockTestFileInfo.testUri);
    await forceLwcTestStartWatchingCurrentFile();
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(true);
    await forceLwcTestStopWatchingCurrentFile();
    expect(testWatcher.isWatchingTest(mockTestFileInfo.testUri)).to.equal(
      false
    );
    unmockActiveTextEditorUri();
  });
});
