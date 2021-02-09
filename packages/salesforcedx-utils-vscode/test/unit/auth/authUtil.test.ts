/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Aliases } from '@salesforce/core';
import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import { createSandbox, SinonSandbox, stub } from 'sinon';

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

const { AuthUtil } = proxyquire.noCallThru()(
  '../../../src/index',
  {
    vscode: vscodeStub
  }
);

describe('AuthUtil', () => {
  let env: SinonSandbox;
  beforeEach(async () => {
    env = createSandbox();
  });
  afterEach(() => env.restore());

  describe('getUsername', () => {
    const username = 'user@test.test';
    const alias = 'TestOrg';

    it('should return the given username or alias if there is no alias', async () => {
      expect(await AuthUtil.getInstance().getUsername(username)).to.equal(username);
      expect(await AuthUtil.getInstance().getUsername(undefined!)).to.equal(undefined);
    });

    it('should return the username for the matching alias', async () => {
      env
        .stub(Aliases, 'fetch')
        .withArgs(alias)
        .returns(username);
      expect(await AuthUtil.getInstance().getUsername(alias)).to.equal(username);
    });
  });

});
