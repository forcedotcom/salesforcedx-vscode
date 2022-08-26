/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
      processCwdStub.returns(
        ConfigAggregatorProvider.defaultBaseProcessDirectoryInVSCE
      );

      // Act
      const configAggregator = await (provider as any).createConfigAggregator({
        globalValuesOnly: true
      });

      // Assert
      expect(processCwdStub.callCount).to.equal(1);
    });
  });
});
