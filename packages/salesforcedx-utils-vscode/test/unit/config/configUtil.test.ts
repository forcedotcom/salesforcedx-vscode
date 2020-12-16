/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import { createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';

const vscodeStub = {
  commands: stub(),
  Disposable: stub(),
  env: {
    machineId: '12345534'
  },
  Uri: {
    parse: stub()
  },
  window: {
    showInformationMessage: stub()
  },
  workspace: {
    getConfiguration: () => {
      return {
        get: () => true
      };
    },
    onDidChangeConfiguration: stub()
  }
};

const { ConfigSource, ConfigUtil } = proxyquire.noCallThru()(
  '../../../src/config/index',
  {
    vscode: vscodeStub
  }
);

describe('getConfigSource', () => {
  let sandboxStub: SinonSandbox;
  let getConfigValueStub: SinonStub;
  beforeEach(() => {
    sandboxStub = createSandbox();
    getConfigValueStub = sandboxStub.stub(ConfigUtil, 'getConfigValue');
  });
  afterEach(() => {
    sandboxStub.restore();
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
  it('should return ConfigSource.None if the key/value is not in the local or global config', async () => {
    getConfigValueStub.onCall(0).returns(undefined);
    getConfigValueStub.onCall(1).returns(undefined);
    const configSource = await ConfigUtil.getConfigSource('key');
    expect(configSource).to.be.eq(ConfigSource.None);
  });
});
