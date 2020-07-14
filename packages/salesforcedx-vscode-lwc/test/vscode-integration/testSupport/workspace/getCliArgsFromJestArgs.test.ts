/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { getCliArgsFromJestArgs } from '../../../../src/testSupport/workspace';
import { TestRunType } from '../../../../src/testSupport/testRunner/testRunner';
import {
  mockPreviewJavaScriptDebugger,
  unmockPreviewJavaScriptDebugger
} from '../mocks';

describe('getCliArgsFromJestArgs Unit Tests', () => {
  const mockJestArgs = [
    '--json',
    '--outputFile',
    'test-result.json',
    '--testLocationInResults',
    '--runTestsByPath',
    'mockTestPath'
  ];

  afterEach(() => {
    unmockPreviewJavaScriptDebugger();
  });

  it('Should return Cli args for run mode', () => {
    mockPreviewJavaScriptDebugger(true);
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.RUN);
    const expectedCliArgs = ['--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });

  it('Should return Cli args for watch mode', () => {
    mockPreviewJavaScriptDebugger(true);
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.WATCH);
    const expectedCliArgs = ['--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });

  it('Should return Cli args for debug mode if not using preview JavaScript debugger', () => {
    mockPreviewJavaScriptDebugger(false);
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.DEBUG);
    const expectedCliArgs = ['--debug', '--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });

  it('Should return Cli args for debug mode if using preview JavaScript debugger', () => {
    mockPreviewJavaScriptDebugger(true);
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.DEBUG);
    const expectedCliArgs = ['--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });
});
