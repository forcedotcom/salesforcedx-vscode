/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import { ConfigAggregatorProvider } from '../../../src/providers/configAggregatorProvider';
import { workspaceUtils } from '../../../src/workspaces';

const sandbox = createSandbox();
const dummyProjectRootWorkspacePath = '/test/home/testProject';

describe('ConfigAggregatorProvider', () => {
  let changeCurrentDirectoryToStub: SinonStub;
  let getRootWorkspacePathStub: SinonStub;
  let configAggregatorProvider: ConfigAggregatorProvider;

  beforeEach(() => {
    getRootWorkspacePathStub = sandbox.stub(
      workspaceUtils,
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
    let configAggregatorCreateStub: SinonStub;

    beforeEach(() => {
      configAggregatorProvider = ConfigAggregatorProvider.getInstance();
      getCurrentDirectoryStub = sandbox.stub(
        (ConfigAggregatorProvider as any).prototype,
        'getCurrentDirectory'
      );
      configAggregatorCreateStub = sandbox
        .stub(ConfigAggregator, 'create')
        .callThrough();
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
      expect(changeCurrentDirectoryToStub.callCount).to.equal(1);
      expect(changeCurrentDirectoryToStub.getCall(0).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
      expect(configAggregatorCreateStub.callCount).to.equal(1);
      expect(configAggregator).to.not.equal(undefined);
    });

    it('should create a ConfigAggregator when inside of a project directory', async () => {
      // Arrange
      getCurrentDirectoryStub.returns(dummyProjectRootWorkspacePath);
      getRootWorkspacePathStub.returns(dummyProjectRootWorkspacePath);

      // Act
      const configAggregator = await (configAggregatorProvider as any).createConfigAggregator();

      // Assert
      expect(configAggregator).to.not.equal(undefined);
      expect(configAggregatorCreateStub.callCount).to.equal(1);
      // createConfigAggregator should store the cwd initially,
      expect(getRootWorkspacePathStub.callCount).to.equal(1);
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      // Since the stubbed current directory is the same as the root
      // workspace path, the directory should not have been changed.
      expect(changeCurrentDirectoryToStub.callCount).to.equal(0);
    });

    it('should change back to the original current directory if ConfigAggregator creation fails', async () => {
      // Arrange
      const dummyErrorMessage =
        'There was a problem creating the Config Aggregator.';
      configAggregatorCreateStub.throws(new Error(dummyErrorMessage));
      getCurrentDirectoryStub
        .onCall(0)
        .returns(ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE);
      getRootWorkspacePathStub.returns(dummyProjectRootWorkspacePath);

      // Act
      let configAggregator;
      let caughtError;
      try {
        configAggregator = await (configAggregatorProvider as any).createConfigAggregator();
      } catch (error) {
        caughtError = error;
      }

      // Assert
      expect(configAggregatorCreateStub.callCount).to.equal(1);
      expect(caughtError.message).to.equal(dummyErrorMessage);
      expect(configAggregator).to.equal(undefined);
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(getCurrentDirectoryStub.callCount).to.equal(2);
      expect(changeCurrentDirectoryToStub.callCount).to.equal(2);
      expect(changeCurrentDirectoryToStub.getCall(0).args[0]).to.equal(
        dummyProjectRootWorkspacePath
      );
      expect(changeCurrentDirectoryToStub.getCall(1).args[0]).to.equal(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );
    });
  });

  describe('getConfigAggregator', () => {
    it('should call createConfigAggregator without options', async () => {
      const configAggregatorCreateSpy = sandbox.spy(
        configAggregatorProvider as any,
        'createConfigAggregator'
      );

      await configAggregatorProvider.getConfigAggregator();

      expect(configAggregatorCreateSpy.callCount).to.equal(1);
      expect(configAggregatorCreateSpy.getCall(0).args[0]).to.equal(undefined);
    });
  });

  describe('reloadConfigAggregators', () => {
    it('should reload the ConfigAggregators for the project root workspace path', async () => {
      getRootWorkspacePathStub.returns(dummyProjectRootWorkspacePath);
      const configAggregator = await configAggregatorProvider.getConfigAggregator();
      const configAggregatorReloadSpy = sandbox.spy(
        ConfigAggregator.prototype,
        'reload'
      );

      await configAggregatorProvider.reloadConfigAggregators();

      expect(configAggregatorReloadSpy.callCount).to.equal(1);
    });
  });
});
