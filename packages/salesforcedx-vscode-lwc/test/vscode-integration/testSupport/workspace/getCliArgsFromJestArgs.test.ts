/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import { workspace, Uri, WorkspaceConfiguration } from 'vscode';
import { getCliArgsFromJestArgs } from '../../../../src/testSupport/workspace';
import { TestRunType } from '../../../../src/testSupport/testRunner/testRunner';

describe('getCliArgsFromJestArgs Unit Tests', () => {
  const mockJestArgs = [
    '--json',
    '--outputFile',
    'test-result.json',
    '--testLocationInResults',
    '--runTestsByPath',
    'mockTestPath'
  ];
  let getConfigurationStub: SinonStub<
    [string?, (Uri | null)?],
    WorkspaceConfiguration
  >;
  let mockBaseConfiguration = {
    has(section: string) {
      return true;
    },
    inspect(section: string) {
      return undefined;
    },
    async update(section: string, value: any) {}
  };
  let mockPreviewJavaScriptDebuggerEnabledConfiguration: WorkspaceConfiguration = {
    ...mockBaseConfiguration,
    get(section: string) {
      if (section === 'javascript.usePreview') return true;
    }
  };
  let mockPreviewJavaScriptDebuggerDisabledConfiguration: WorkspaceConfiguration = {
    ...mockBaseConfiguration,
    get(section: string) {
      if (section === 'javascript.usePreview') return false;
    }
  };

  beforeEach(() => {
    getConfigurationStub = stub(workspace, 'getConfiguration');
    getConfigurationStub.returns(
      mockPreviewJavaScriptDebuggerEnabledConfiguration
    );
  });
  afterEach(() => {
    getConfigurationStub.restore();
  });

  it('Should return Cli args for run mode', () => {
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.RUN);
    const expectedCliArgs = ['--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });

  it('Should return Cli args for watch mode', () => {
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.WATCH);
    const expectedCliArgs = ['--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });

  it('Should return Cli args for debug mode', () => {
    getConfigurationStub.returns(
      mockPreviewJavaScriptDebuggerDisabledConfiguration
    );
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.DEBUG);
    const expectedCliArgs = ['--debug', '--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });

  it('Should return Cli args for debug mode if using preview JavaScript debugger', () => {
    getConfigurationStub.returns(
      mockPreviewJavaScriptDebuggerEnabledConfiguration
    );
    const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.DEBUG);
    const expectedCliArgs = ['--', ...mockJestArgs];
    expect(cliArgs).to.eql(expectedCliArgs);
  });
});
