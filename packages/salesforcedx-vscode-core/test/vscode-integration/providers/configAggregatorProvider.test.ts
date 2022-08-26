/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { ConfigAggregatorProvider } from '../../../src/providers/configAggregatorProvider';

const sandbox = createSandbox();

describe('ConfigAggregatorProvider', () => {
  afterEach(() => {
    sandbox.restore();
  });

  describe('createConfigAggregator', () => {
    let provider: ConfigAggregatorProvider;
    beforeEach(() => {
      provider = ConfigAggregatorProvider.getInstance();
    });

    it('should create a global ConfigAggregator', async () => {
      // Arrange
      const processCwdStub = sandbox.stub(process, 'cwd');
      const processChdirStub = sandbox.spy(process, 'chdir');
      const configAggregatorCreateStub = sandbox.spy(
        ConfigAggregator,
        'create'
      );
      processCwdStub.returns(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );

      // Act
      const globalConfigAggregator = await (provider as any).createConfigAggregator(
        {
          globalValuesOnly: true
        }
      );

      // Assert
      // createConfigAggregator should store the cwd initially,
      // and check it again after creating the ConfigAggregator
      // to ensure that the cwd is set back to its original value.
      expect(processCwdStub.callCount).to.equal(2);
      // Since the stubbed directory is not an sfdx project directory,
      // createConfigAggregator should not need to change the dir
      // to produce a global ConfigAggregator.
      expect(processChdirStub.callCount).to.equal(0);
      expect(configAggregatorCreateStub.callCount).to.equal(1);
      expect(globalConfigAggregator).to.not.equal(undefined);
    });
  });
});
