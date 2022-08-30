/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator, SfdxConfigAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { createSandbox, SinonSpy, SinonStub } from 'sinon';
import Sinon = require('sinon');
import { ConfigAggregatorProvider } from '../../../src/providers/configAggregatorProvider';

const sandbox = createSandbox();
const dummyProjectRootWorkspacePath = '/test/home/testProject';

describe('ConfigAggregatorProvider', () => {
  let changeCurrentDirectoryToStub: SinonStub;
  let getRootWorkspacePathStub: SinonStub;
  let configAggregatorProvider: ConfigAggregatorProvider;

  beforeEach(() => {
    getRootWorkspacePathStub = sandbox.stub(
      ConfigAggregatorProvider.prototype as any,
      'getRootWorkspacePath'
    );
    changeCurrentDirectoryToStub = sandbox.stub(
      ConfigAggregatorProvider.prototype as any,
      'changeCurrentDirectoryTo'
    );
    configAggregatorProvider = ConfigAggregatorProvider.getInstance();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createConfigAggregator', () => {
    let getCurrentDirectoryStub: SinonStub;
    let configAggregatorCreateSpy: SinonSpy;

    beforeEach(() => {
      configAggregatorProvider = ConfigAggregatorProvider.getInstance();
      getCurrentDirectoryStub = sandbox.stub(
        (ConfigAggregatorProvider as any).prototype,
        'getCurrentDirectory'
      );
      configAggregatorCreateSpy = sandbox.spy(ConfigAggregator, 'create');
    });

    it('should create a ConfigAggregator when outside of a project directory', async () => {
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
      // createConfigAggregator should change the process to the
      // root project workspace path to create the ConfigAggregator,
      // then change back to the original directory.
      expect(changeCurrentDirectoryToStub.callCount).to.equal(2);
      expect(changeCurrentDirectoryToStub.getCall(1).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregator).to.not.equal(undefined);
    });

    it('should create a ConfigAggregator when inside of a project directory', async () => {
      // Arrange
      getCurrentDirectoryStub.returns(dummyProjectRootWorkspacePath);
      getRootWorkspacePathStub.returns(dummyProjectRootWorkspacePath);

      // Act
      const configAggregator = await (configAggregatorProvider as any).createConfigAggregator();

      // Assert
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      // Since the stubbed current directory is the same as the root
      // workspace path, the directory should not have been changed.
      expect(changeCurrentDirectoryToStub.callCount).to.equal(0);
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregator).to.not.equal(undefined);
      expect(getRootWorkspacePathStub.callCount).to.equal(1);
    });

    it('should create a global ConfigAggregator when outside of a project directory', async () => {
      // Arrange
      getCurrentDirectoryStub.returns(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );

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
      expect(changeCurrentDirectoryToStub.callCount).to.equal(0);
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(globalConfigAggregator).to.not.equal(undefined);
    });

    it('should create a global ConfigAggregator when inside of a project directory', async () => {
      // Arrange
      getCurrentDirectoryStub.onCall(0).returns(dummyProjectRootWorkspacePath);
      getCurrentDirectoryStub
        .onCall(1)
        .returns(ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE);

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
      expect(changeCurrentDirectoryToStub.callCount).to.equal(2);
      expect(changeCurrentDirectoryToStub.getCall(0).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      expect(changeCurrentDirectoryToStub.getCall(1).args[0]).to.equal(
        dummyProjectRootWorkspacePath
      );
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(globalConfigAggregator).to.not.equal(undefined);
    });

    it('should create an SfdxConfigAggregator', async () => {
      // Arrange
      getCurrentDirectoryStub
        .onCall(0)
        .returns(ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE);
      const sfdxConfigAggregatorCreateSpy = sandbox.spy(
        SfdxConfigAggregator,
        'create'
      );

      // Act
      const sfdxConfigAggregator = await (configAggregatorProvider as any).createConfigAggregator(
        { sfdx: true }
      );

      // Assert
      expect(sfdxConfigAggregatorCreateSpy.callCount).to.equal(1);
      expect(sfdxConfigAggregator).to.not.equal(undefined);
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
      expect(changeCurrentDirectoryToStub.callCount).to.equal(2);
      expect(changeCurrentDirectoryToStub.getCall(1).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      expect(configAggregatorCreateStub.callCount).to.equal(1);
      expect(caughtError).to.not.equal(undefined);
      expect(configAggregator).to.equal(undefined);
    });
  });

  describe('getConfigAggregator', () => {
    it('should call createConfigAggregator without options', async () => {
      // Act
      const configAggregatorCreateSpy = sandbox.spy(
        configAggregatorProvider as any,
        'createConfigAggregator'
      );

      // Act
      await configAggregatorProvider.getConfigAggregator();

      // Assert
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregatorCreateSpy.getCall(0).args[0]).to.equal(undefined);
    });
  });

  describe('getSfdxConfigAggregator', () => {
    it('should call createConfigAggregator with the sfdx option', async () => {
      // Act
      const configAggregatorCreateSpy = sandbox.spy(
        configAggregatorProvider as any,
        'createConfigAggregator'
      );

      // Act
      await configAggregatorProvider.getSfdxConfigAggregator();

      // Assert
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregatorCreateSpy.getCall(0).args[0]).to.deep.equal({
        sfdx: true
      });
    });
  });

  describe('getGlobalConfigAggregator', () => {
    it('should call createConfigAggregator with the global values only option', async () => {
      // Act
      const configAggregatorCreateSpy = sandbox.spy(
        configAggregatorProvider as any,
        'createConfigAggregator'
      );

      // Act
      await configAggregatorProvider.getGlobalConfigAggregator();

      // Assert
      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregatorCreateSpy.getCall(0).args[0]).to.deep.equal({
        globalValuesOnly: true
      });
    });
  });

  describe('reloadConfigAggregators', () => {
    it.only('should reload the ConfigAggregators for the project root workspace path', async () => {
      // Arrange
      getRootWorkspacePathStub.returns(dummyProjectRootWorkspacePath);
      const configAggregator = await configAggregatorProvider.getConfigAggregator();
      const sfdxConfigAggregator = await configAggregatorProvider.getSfdxConfigAggregator();
      const configAggregatorReloadSpy = sandbox.spy(
        ConfigAggregator.prototype,
        'reload'
      );

      // Act
      await configAggregatorProvider.reloadConfigAggregators();

      // Assert
      expect(configAggregatorReloadSpy.callCount).to.equal(2);
    });
  });
});
