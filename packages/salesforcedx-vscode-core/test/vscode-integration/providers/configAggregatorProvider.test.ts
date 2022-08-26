/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { createSandbox, SinonSpy, SinonStub } from 'sinon';
import { ConfigAggregatorProvider } from '../../../src/providers/configAggregatorProvider';

const sandbox = createSandbox();
const dummyProjectRootWorkspacePath = '/test/home/testProject';

describe('ConfigAggregatorProvider', () => {
  afterEach(() => {
    sandbox.restore();
  });

  describe('createConfigAggregator', () => {
    let configAggregatorProvider: ConfigAggregatorProvider;
    let getCurrentDirectoryStub: SinonStub;
    let configAggregatorCreateSpy: SinonSpy;

    beforeEach(() => {
      configAggregatorProvider = ConfigAggregatorProvider.getInstance();
      getCurrentDirectoryStub = sandbox.stub(
        ConfigAggregatorProvider.prototype,
        'getCurrentDirectory'
      );
      configAggregatorCreateSpy = sandbox.spy(ConfigAggregator, 'create');
    });

    it('should create a global ConfigAggregator', async () => {
      // Arrange
      getCurrentDirectoryStub.returns(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      const processChdirStub = sandbox.spy(process, 'chdir');

      // Act
      const globalConfigAggregator = await (configAggregatorProvider as any).createConfigAggregator(
        {
          globalValuesOnly: true
        }
      );

      // Assert
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      // Since the stubbed directory is not an sfdx project directory,
      // createConfigAggregator should not need to change the dir
      // to produce a global ConfigAggregator.
      expect(processChdirStub.callCount).to.equal(0);
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(globalConfigAggregator).to.not.equal(undefined);
    });

    it('should create a global ConfigAggregator from within a project', async () => {
      // Arrange
      getCurrentDirectoryStub.onCall(0).returns(dummyProjectRootWorkspacePath);
      getCurrentDirectoryStub
        .onCall(1)
        .returns(ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE);
      const processChdirStub = sandbox.stub(process, 'chdir');

      // Act
      const globalConfigAggregator = await (configAggregatorProvider as any).createConfigAggregator(
        {
          globalValuesOnly: true
        }
      );

      // Assert
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      // Since the stubbed current directory is not equal to the
      // ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE directory,
      // createConfigAggregator should change the dir to be the default dir
      // to produce a global ConfigAggregator.
      expect(processChdirStub.callCount).to.equal(2);
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(globalConfigAggregator).to.not.equal(undefined);
    });

    it('should create a ConfigAggregator', async () => {});

    it('should create a ConfigAggregator from within a project', async () => {});
  });

  describe('getConfigAggregator', () => {});
  describe('getSfdxConfigAggregator', () => {});
  describe('getGlobalConfigAggregator', () => {});
  describe('reloadConfigAggregators', () => {});
});
