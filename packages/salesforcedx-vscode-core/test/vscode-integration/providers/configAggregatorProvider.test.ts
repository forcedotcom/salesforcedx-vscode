/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { createSandbox, SinonSpy, SinonStub } from 'sinon';
import Sinon = require('sinon');
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
    let changeCurrentDirectoryToSpy: SinonSpy;

    beforeEach(() => {
      configAggregatorProvider = ConfigAggregatorProvider.getInstance();
      getCurrentDirectoryStub = sandbox.stub(
        (ConfigAggregatorProvider as any).prototype,
        'getCurrentDirectory'
      );
      changeCurrentDirectoryToSpy = sandbox.spy(
        (ConfigAggregatorProvider as any).prototype,
        'changeCurrentDirectoryTo'
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
      // to produce a global ConfigAggregator, then change the dir back
      // to the original dir before exiting.
      expect(processChdirStub.callCount).to.equal(2);
      expect(processChdirStub.getCall(0).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      expect(processChdirStub.getCall(1).args[0]).to.equal(
        dummyProjectRootWorkspacePath
      );
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(globalConfigAggregator).to.not.equal(undefined);
    });

    it('should create a ConfigAggregator', async () => {
      // Arrange
      getCurrentDirectoryStub
        .onCall(0)
        .returns(ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE);

      // Act
      const configAggregator = await (configAggregatorProvider as any).createConfigAggregator();

      // Assert
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      // Since the stubbed directory is not an sfdx project directory,
      // createConfigAggregator should not need to change the dir
      // to produce a global ConfigAggregator.
      expect(changeCurrentDirectoryToSpy.callCount).to.equal(2);
      expect(changeCurrentDirectoryToSpy.getCall(1).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregator).to.not.equal(undefined);
    });

    it('should create a ConfigAggregator from within a project', async () => {
      // Arrange
      getCurrentDirectoryStub.returns(dummyProjectRootWorkspacePath);
      const getRootWorkspacePathStub = sandbox
        .stub(
          (ConfigAggregatorProvider as any).prototype,
          'getRootWorkspacePath'
        )
        .returns(dummyProjectRootWorkspacePath);
      const processChdirStub = sandbox.stub(process, 'chdir');

      // Act
      const configAggregator = await (configAggregatorProvider as any).createConfigAggregator();

      // Assert
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      // Since the stubbed current directory is not equal to the
      // ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE directory,
      // createConfigAggregator should change the dir to be the default dir
      // to produce a global ConfigAggregator, then change the dir back
      // to the original dir before exiting.
      expect(changeCurrentDirectoryToSpy.callCount).to.equal(0);
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregator).to.not.equal(undefined);
      expect(getRootWorkspacePathStub.callCount).to.equal(1);
    });

    it('should change back to the original current directory if ConfigAggregator creation fails', async () => {
      // Arrange
      configAggregatorCreateSpy.restore();
      const configAggregatorCreateStub = Sinon.stub(ConfigAggregator, 'create');
      configAggregatorCreateStub.throws(
        new Error('There was a problem creating the Config Aggregator.')
      );
      getCurrentDirectoryStub
        .onCall(0)
        .returns(ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE);

      // Act
      let configAggregator;
      let caughtError;
      try {
        configAggregator = await (configAggregatorProvider as any).createConfigAggregator();
      } catch (error) {
        caughtError = error;
      }

      // Assert
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      expect(changeCurrentDirectoryToSpy.callCount).to.equal(2);
      expect(changeCurrentDirectoryToSpy.getCall(1).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      expect(configAggregatorCreateStub.callCount).to.equal(1);
      expect(caughtError).to.not.equal(undefined);
      expect(configAggregator).to.equal(undefined);
    });
  });

  describe('getConfigAggregator', () => {
    it('should call createConfigAggregator without options', async () => {});
  });
  describe('getSfdxConfigAggregator', () => {
    it('should call createConfigAggregator with the sfdx option', async () => {});
  });
  describe('getGlobalConfigAggregator', () => {
    it('should call createConfigAggregator with the global values only option', async () => {});
  });
  describe('reloadConfigAggregators', () => {
    it('should reload the ConfigAggregator for the project root workspace path', async () => {});
  });
});
