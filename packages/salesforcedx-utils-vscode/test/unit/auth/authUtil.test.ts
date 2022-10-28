/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StateAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, stub } from 'sinon';
import { AuthUtil } from '../../../src';

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
});
