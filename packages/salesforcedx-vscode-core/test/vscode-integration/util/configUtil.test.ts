/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator } from '@salesforce/core';
import { ConfigAggregatorProvider } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import { ConfigSource, ConfigUtil } from '../../../src/util';

describe('getConfigSource', () => {
  let sandbox = createSandbox();
  let getLocationStub: SinonStub;

  beforeEach(() => {
    getLocationStub = sandbox.stub();
    sandbox.stub(ConfigAggregatorProvider, 'getInstance').returns({
      getConfigAggregator: sandbox.stub().resolves({
        getLocation: getLocationStub
      })
    });
  });
  afterEach(() => {
    sandbox.restore();
  });
  it('should return ConfigSource.Local if the key/value is in the local config', async () => {
    getLocationStub.returns(ConfigAggregator.Location.LOCAL);
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.Local);
  });
  it('should return ConfigSource.Global if the key/value is in the global config', async () => {
    getLocationStub.returns(ConfigAggregator.Location.GLOBAL);
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.Global);
  });
  it('should return ConfigSource.None if the key/value is not in the local or global config', async () => {
    getLocationStub.returns(undefined);
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.None);
  });
});
