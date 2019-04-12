/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ConfigSource, ConfigUtil } from '../../../src/util';

describe('getConfigSource', () => {
  let getConfigValueStub: sinon.SinonStub;
  beforeEach(() => {
    getConfigValueStub = sinon.stub(ConfigUtil, 'getConfigValue');
  });
  afterEach(() => {
    getConfigValueStub.restore();
  });
  it('should return ConfigSource.Local if the key/value is in the local config', async () => {
    getConfigValueStub.onCall(0).returns('someValue');
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.Local);
  });
  it('should return ConfigSource.Global if the key/value is in the global config', async () => {
    getConfigValueStub.onCall(0).returns(undefined);
    getConfigValueStub.onCall(1).returns('someValue');
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.Global);
  });
  it('should return ConfigSource.None if the key/value is in the global config', async () => {
    getConfigValueStub.onCall(0).returns(undefined);
    getConfigValueStub.onCall(1).returns(undefined);
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.None);
  });
});
