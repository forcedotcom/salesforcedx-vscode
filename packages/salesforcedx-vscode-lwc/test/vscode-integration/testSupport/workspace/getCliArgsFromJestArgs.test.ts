/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { SinonStub, stub } from 'sinon';
import {
  getCliArgsFromJestArgs,
  workspaceService
} from '../../../../src/testSupport/workspace';
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
  let getCurrentWorkspaceTypeStub: SinonStub;
  beforeEach(() => {
    getCurrentWorkspaceTypeStub = stub(
      workspaceService,
      'getCurrentWorkspaceType'
    );
  });
  afterEach(() => {
    getCurrentWorkspaceTypeStub.restore();
  });

  describe('SFDX Workspace', () => {
    beforeEach(() => {
      getCurrentWorkspaceTypeStub.returns(lspCommon.WorkspaceType.SFDX);
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
      const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.DEBUG);
      const expectedCliArgs = ['--debug', '--', ...mockJestArgs];
      expect(cliArgs).to.eql(expectedCliArgs);
    });
  });

  describe('Internal Dev Workspace', () => {
    beforeEach(() => {
      getCurrentWorkspaceTypeStub.returns(lspCommon.WorkspaceType.CORE_PARTIAL);
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
      const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.DEBUG);
      const expectedCliArgs = ['--debug', '--', ...mockJestArgs];
      expect(cliArgs).to.eql(expectedCliArgs);
    });
  });

  describe('Unknown Workspace', () => {
    beforeEach(() => {
      getCurrentWorkspaceTypeStub.returns(lspCommon.WorkspaceType.UNKNOWN);
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
      const cliArgs = getCliArgsFromJestArgs(mockJestArgs, TestRunType.DEBUG);
      const expectedCliArgs = ['--debug', '--', ...mockJestArgs];
      expect(cliArgs).to.eql(expectedCliArgs);
    });
  });
});
