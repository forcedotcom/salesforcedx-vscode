/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OrgConfigProperties, StateAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { createSandbox, SinonStub, stub } from 'sinon';
import {
  ConfigAggregatorProvider,
  ConfigSource,
  ConfigUtil
} from '../../../src';

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

describe('getConfigSource', () => {
  const sandbox = createSandbox();
  let getConfigValueStub: SinonStub;

  beforeEach(() => {
    getConfigValueStub = sandbox.stub(ConfigUtil, 'getConfigValue');
  });

  afterEach(() => {
    sandbox.restore();
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

  describe('getUsername', () => {
    const testAlias = 'aFakeAlias';
    const testUsername = 'a.f.alias@salesforce.com';

    let getUserNameStub: SinonStub;
    let getPropertyValueStub: SinonStub;

    beforeEach(() => {
      getUserNameStub = sandbox.stub();
      sandbox.stub(StateAggregator, 'getInstance').resolves({
        aliases: {
          getUsername: getUserNameStub
        }
      });

      getPropertyValueStub = sandbox.stub();
      sandbox
        .stub(ConfigAggregatorProvider.prototype, 'getConfigAggregator')
        .resolves({
          getPropertyValue: getPropertyValueStub
        });
    });

    it('Should return the currently auth username.', async () => {
      getPropertyValueStub.returns(testAlias);
      getUserNameStub.returns(testUsername);

      const username = await ConfigUtil.getUsername();

      expect(username).to.equal(testUsername);
      expect(getPropertyValueStub.callCount).to.equal(1);
      expect(getPropertyValueStub.getCall(0).args[0]).to.equal(
        OrgConfigProperties.TARGET_ORG
      );
      expect(getUserNameStub.callCount).to.equal(1);
      expect(getUserNameStub.getCall(0).args[0]).to.equal(testAlias);
    });

    it('Should return undefined if no username or alias is found.', async () => {
      getPropertyValueStub.returns(undefined);

      const username = await ConfigUtil.getUsername();

      expect(username).to.equal(undefined);
      expect(getPropertyValueStub.callCount).to.equal(1);
      expect(getUserNameStub.callCount).to.equal(0);
    });

    it('Should return undefined if not able to find username from alias.', async () => {
      getPropertyValueStub.returns(testAlias);
      getUserNameStub.returns(null);

      const username = await ConfigUtil.getUsername();

      expect(username).to.equal(undefined);
      expect(getPropertyValueStub.callCount).to.equal(1);
      expect(getUserNameStub.callCount).to.equal(1);
      expect(getUserNameStub.getCall(0).args[0]).to.equal(testAlias);
    });
  });
});
