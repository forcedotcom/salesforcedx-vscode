/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StateAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { assert, createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';
import { TelemetryService } from '../../../src';
import { AuthUtil, ConfigUtil } from '../../../src';

describe('AuthUtil', () => {
  let env: SinonSandbox;
  beforeEach(async () => {
    env = createSandbox();
    await StateAggregator.create();
  });
  afterEach(() => {
    StateAggregator.clearInstance();
    env.restore();
  });

  describe('getUsername', () => {
    const username = 'user@test.test';
    const alias = 'TestOrg';

    it('should return the given username or alias if there is no alias', async () => {
      expect(await AuthUtil.getInstance().getUsername(username)).to.equal(
        username
      );
      expect(await AuthUtil.getInstance().getUsername(undefined!)).to.equal(
        undefined
      );
    });

    it('should return the username for the matching alias', async () => {
      const info = await StateAggregator.getInstance();
      env
        .stub(info.aliases, 'getUsername')
        .withArgs(alias)
        .returns(username);
      expect(await AuthUtil.getInstance().getUsername(alias)).to.equal(
        username
      );
    });
  });

  describe('getDefaultUsernameOrAlias', () => {
    const username = 'user@test.test';
    let errorStub: SinonStub;
    let consoleStub: SinonStub;

    it('should return undefined if there is no default username', async () => {
      expect(await AuthUtil.getInstance().getDefaultUsernameOrAlias(true)).to.equal(
        undefined
      );
    });

    it('should return the default username', async () => {
      env
        .stub(ConfigUtil, 'getDefaultUsernameOrAlias')
        .returns(username);
      expect(await AuthUtil.getInstance().getDefaultUsernameOrAlias(true)).to.equal(
        username
      );
    });

    it('should send exception if error', async () => {
      consoleStub = env.stub(console, 'log');
      const error = new Error('sample error');
      error.name = 'aFakeError';
      errorStub = env.stub(
        TelemetryService.getInstance(),
        'sendException'
      );
      errorStub.throws({ error });
      let defaultUsernameOrAlias;
      try {
        defaultUsernameOrAlias = await AuthUtil.getInstance().getDefaultUsernameOrAlias(true);
      } catch (e) {
        assert.calledOnce(errorStub);
        assert.calledWith(errorStub, 'get_default_username_alias', error.message);
        expect(defaultUsernameOrAlias).to.equal(
          undefined
        );
        assert.calledWith(consoleStub, error);
      }
    });
  });
});
